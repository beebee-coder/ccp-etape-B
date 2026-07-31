"use client";

import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { teams, rolesConfig } from "@/data/teams";

export default function EquipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = Number(params.teamId);
  const team = teams.find((t) => t.id === teamId);

  if (!team) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="dashboard-card flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Équipe introuvable</p>
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
          <p className="mt-0.5 text-sm text-muted-foreground">{team.description}</p>
        </div>
      </div>

      {/* ── Members grid ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {team.members_list.map((member) => {
          const roleCfg = rolesConfig[member.role];
          const isChef = member.role === "chef_de_quart" || member.role.startsWith("chef_de_bloc");
          return (
            <Card
              key={member.id}
              className="dashboard-card p-6 cursor-pointer text-center flex flex-col items-center"
              onClick={() => router.push(`/equipes/${team.id}/${member.id}`)}
            >
              <div className="relative mb-4">
                <div
                  className={`absolute inset-0 rounded-full ${
                    member.status === "active"
                      ? "bg-emerald-500/20"
                      : "bg-muted/20"
                  } blur-md`}
                />
                <div
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full",
                    member.status === "active"
                      ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/20"
                      : "bg-muted/30 border-2 border-border/40"
                  )}
                >
                  {member.avatar}
                </div>
              </div>
              <h3 className="text-base font-semibold text-foreground">{member.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
              <div className="mt-3">
                <Badge
                  variant={isChef ? "default" : "secondary"}
                  className={cn(
                    "text-xs rounded-full",
                    isChef
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/30 text-muted-foreground border-border/40"
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
    </section>
  );
}
