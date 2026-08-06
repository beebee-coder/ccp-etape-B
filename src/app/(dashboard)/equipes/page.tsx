"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Search,
  Crown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { teamsService } from "@/lib/teams/teams-service";
import type { TeamInfo } from "@/lib/teams/schemas";
import { toast } from "sonner";

const PAGE_LOG_PREFIX = "[equipes-page]";

export default function EquipesPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    console.log(`${PAGE_LOG_PREFIX} fetchTeams: starting`);
    setLoading(true);
    setError(null);
    try {
      const data = await teamsService.getAll();
      console.log(`${PAGE_LOG_PREFIX} fetchTeams: data received`, {
        count: data.length,
      });
      setTeams(data);
    } catch (err) {
      console.error(`${PAGE_LOG_PREFIX} fetchTeams: error`, { error: err });
      setError("Impossible de charger les équipes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const filteredTeams = teams.filter((team) => {
    const q = search.toLowerCase();
    return (
      team.name.toLowerCase().includes(q) ||
      team.description.toLowerCase().includes(q)
    );
  });

  const handleCreateTeam = async () => {
    console.log(`${PAGE_LOG_PREFIX} handleCreateTeam: creating default team`);
    setCreating(true);
    try {
      const created = await teamsService.create({
        name: "Nouvelle Équipe",
        description: "Équipe en cours de création",
        color: "bg-blue-500",
        members: [],
      });
      console.log(`${PAGE_LOG_PREFIX} handleCreateTeam: team created`, {
        id: created.id,
      });
      toast.success("Équipe créée avec succès");
      setTeams((prev) => [created, ...prev]);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      console.error(`${PAGE_LOG_PREFIX} handleCreateTeam: error`, {
        error: e,
        status: e?.status,
      });
      if (e?.status === 401) {
        return;
      }
      if (e?.status === 403) {
        toast.error("Vous n'êtes pas autorisé à créer une équipe");
      } else {
        toast.error(e?.message || "Erreur lors de la création de l'équipe");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <Users className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Équipes
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {teams.length} équipes ·{" "}
            {teams.reduce((acc, t) => acc + t.membersList.length, 0)} postes
          </p>
        </div>
      </div>

      {/* ── Search + actions ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une équipe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-64 bg-background/60 border-border/60 rounded-xl focus:border-primary/50 focus:shadow-primary-glow transition-all duration-200"
          />
        </div>
        <Button
          onClick={handleCreateTeam}
          disabled={creating}
          className="gap-1.5 btn-primary-gradient"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Nouvelle équipe
        </Button>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div className="mt-6 rounded-xl bg-destructive/10 border border-destructive/20 p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* ── Teams grid ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {loading ? (
          <div className="lg:col-span-1 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="dashboard-card p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-muted/30" />
                    <div className="h-3 w-full rounded bg-muted/30" />
                    <div className="h-3 w-2/3 rounded bg-muted/30" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="lg:col-span-3">
            <Card className="dashboard-card flex h-64 items-center justify-center p-12 text-center">
              <div>
                <Search className="h-10 w-10 text-muted-foreground/40 mb-3 mx-auto" />
                <p className="text-sm font-medium text-foreground">
                  Aucune équipe trouvée
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? "Essayez un autre terme de recherche."
                    : "Commencez par créer une équipe."}
                </p>
              </div>
            </Card>
          </div>
        ) : (
          <div className="lg:col-span-1 space-y-3">
            {filteredTeams.map((team) => (
              <Card
                key={team.id}
                className="dashboard-card p-4 cursor-pointer transition-all duration-200 hover:shadow-3d-lg hover:-translate-y-0.5"
                onClick={() => router.push(`/equipes/${team.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${team.color} bg-opacity-10`}
                  >
                    <Users
                      className={`h-5 w-5 ${team.color.replace("bg-", "text-")}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {team.name}
                      </h3>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-primary/10 text-primary border-primary/20"
                      >
                        {team.members}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {team.description}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Crown className="h-3 w-3 text-amber-500" />1 chef de
                        quart
                      </span>
                      <span className="text-border">·</span>
                      <span>2 chefs de bloc</span>
                      <span className="text-border">·</span>
                      <span>4 rondiers</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!loading && (
          <div className="lg:col-span-2">
            <Card className="dashboard-card flex h-full flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 border border-border/40 shadow-3d-sm">
                <Users className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Sélectionnez une équipe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur une équipe pour accéder à sa page détaillée et voir
                ses membres.
              </p>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}
