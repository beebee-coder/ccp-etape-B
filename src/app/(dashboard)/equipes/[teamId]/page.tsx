"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserCheck, UserX, Users, Loader2, AlertCircle } from "lucide-react";
import { teamsService } from "@/lib/teams/teams-service";
import { rolesConfig } from "@/data/teams";
import type { TeamInfo } from "@/lib/teams/schemas";
import { toast } from "sonner";

const PAGE_LOG_PREFIX = "[equipe-detail-page]";

function handleAuthError(response: Response): boolean {
  if (response.status === 401) {
    console.log(`${PAGE_LOG_PREFIX} auth error, redirecting to login`, {
      status: response.status,
    });
    window.location.href = "/login?callbackUrl=/equipes";
    return true;
  }
  if (response.status === 403) {
    console.log(`${PAGE_LOG_PREFIX} permission denied`, {
      status: response.status,
    });
    toast.error("Vous n'êtes pas autorisé à effectuer cette action");
    return true;
  }
  return false;
}

export default function EquipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = Number(params.teamId);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    if (Number.isNaN(teamId)) {
      console.error(`${PAGE_LOG_PREFIX} fetchTeam: invalid teamId`, {
        teamId: params.teamId,
      });
      setError("ID d'équipe invalide");
      setLoading(false);
      return;
    }

    console.log(`${PAGE_LOG_PREFIX} fetchTeam: starting`, { teamId });
    try {
      const data = await teamsService.getById(teamId);
      console.log(`${PAGE_LOG_PREFIX} fetchTeam: data received`, {
        teamId,
        name: data.name,
        memberCount: data.membersList.length,
      });
      setTeam(data);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      console.error(`${PAGE_LOG_PREFIX} fetchTeam: error`, {
        error: e,
        teamId,
        status: e?.status,
      });
      if (e?.status === 401 || e?.status === 403) {
        handleAuthError({ status: e.status } as Response);
      } else {
        setError("Impossible de charger l'équipe");
      }
    } finally {
      setLoading(false);
    }
  }, [teamId, params.teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/30">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
          <div>
            <div className="h-6 w-32 rounded bg-muted/30 animate-pulse" />
            <div className="mt-1 h-4 w-48 rounded bg-muted/30 animate-pulse" />
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="dashboard-card p-6 animate-pulse">
              <div className="flex flex-col items-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-muted/30" />
                <div className="h-4 w-24 rounded bg-muted/30" />
                <div className="h-3 w-32 rounded bg-muted/30" />
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error || !team) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="dashboard-card flex h-64 items-center justify-center">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {error || "Équipe introuvable"}
            </p>
          </div>
        </Card>
      </section>
    );
  }

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
            {team.name}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {team.description}
          </p>
        </div>
      </div>

      {/* ── Members grid ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {team.membersList.map((member) => {
          const roleCfg = rolesConfig[member.role];
          const isChef =
            member.role === "chef_de_quart" ||
            member.role.startsWith("chef_de_bloc");
          return (
            <Card
              key={member.id}
              className="dashboard-card p-6 cursor-pointer text-center flex flex-col items-center"
              onClick={() => router.push(`/equipes/${team.id}/${member.id}`)}
            >
              <div className="relative mb-4">
                <div
                  className={cn(
                    "absolute inset-0 rounded-full",
                    member.status === "active"
                      ? "bg-emerald-500/20"
                      : "bg-muted/20",
                    "blur-md",
                  )}
                />
                <div
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full",
                    member.status === "active"
                      ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/20"
                      : "bg-muted/30 border-2 border-border/40",
                  )}
                >
                  {member.avatar}
                </div>
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {member.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {member.email}
              </p>
              <div className="mt-3">
                <Badge
                  variant={isChef ? "default" : "secondary"}
                  className={cn(
                    "text-xs rounded-full",
                    isChef
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/30 text-muted-foreground border-border/40",
                  )}
                >
                  {roleCfg?.label ?? member.role}
                </Badge>
              </div>
              <div className="mt-4 flex items-center gap-1">
                {member.status === "active" ? (
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                ) : (
                  <UserX className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground capitalize">
                  {member.status === "active" ? "Actif" : "Absent"}
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {team.membersList.length === 0 && (
        <Card className="dashboard-card flex h-48 items-center justify-center mt-6">
          <p className="text-sm text-muted-foreground">
            Aucun membre dans cette équipe.
          </p>
        </Card>
      )}
    </section>
  );
}
