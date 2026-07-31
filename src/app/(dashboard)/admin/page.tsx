"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, FileText, Activity, AlertTriangle } from "lucide-react";

export default function AdminDashboard() {
  const stats = [
    { title: "Utilisateurs", value: "1 248", change: "+12%", trend: "up", icon: Users },
    { title: "Procédures", value: "86", change: "+4%", trend: "up", icon: FileText },
    { title: "Workflows actifs", value: "324", change: "-2%", trend: "down", icon: Activity },
    { title: "Erreurs 24h", value: "7", change: "-18%", trend: "up", icon: AlertTriangle },
  ];

  const users = [
    { name: "Alice Martin", email: "alice@exemple.com", role: "Admin", status: "Actif" },
    { name: "Bob Dupont", email: "bob@exemple.com", role: "User", status: "Actif" },
    { name: "Claire Leroy", email: "claire@exemple.com", role: "User", status: "En attente" },
    { name: "David Moreau", email: "david@exemple.com", role: "User", status: "Actif" },
    { name: "Emma Petit", email: "emma@exemple.com", role: "User", status: "Inactif" },
  ];

  const logs = [
    { time: "14:32", action: "Nouveau workflow créé", user: "Alice Martin" },
    { time: "14:15", action: "Mise à jour des tarifs", user: "System" },
    { time: "13:58", action: "Suppression d'une procédure", user: "Bob Dupont" },
    { time: "13:40", action: "Connexion depuis Paris", user: "Claire Leroy" },
    { time: "12:22", action: "Déploiement terminé", user: "System" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <Activity className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Administration
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Vue d&apos;ensemble de la plateforme NexaFlow.
          </p>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="mb-6 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => alert("Export en cours...")}
          className="rounded-xl border-border/60 bg-card/60 backdrop-blur-sm hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          Exporter
        </Button>
        <Button
          size="sm"
          onClick={() => alert("Données rafraîchies")}
          className="gap-1.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary to-purple-600 shadow-3d-sm text-white hover:-translate-y-0.5 hover:shadow-primary-glow active:translate-y-0 transition-all duration-200"
        >
          Rafraîchir
        </Button>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className="stat-card relative overflow-hidden"
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                  <Icon className="h-6 w-6" />
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    stat.trend === "up"
                      ? "text-emerald-500"
                      : "text-rose-500"
                  )}
                >
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.title}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Content grid ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ── Users table card ── */}
        <Card className="dashboard-card overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-foreground">Utilisateurs récents</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="pb-3 pl-6 font-semibold text-muted-foreground">Nom</th>
                  <th className="pb-3 font-semibold text-muted-foreground">Email</th>
                  <th className="pb-3 font-semibold text-muted-foreground">Rôle</th>
                  <th className="pb-3 pr-6 font-semibold text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.email}
                    className="border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20"
                  >
                    <td className="py-3.5 pl-6 font-medium text-foreground">{user.name}</td>
                    <td className="py-3.5 text-muted-foreground">{user.email}</td>
                    <td className="py-3.5 text-muted-foreground">{user.role}</td>
                    <td className="py-3.5 pr-6">
                      <Badge
                        variant={
                          user.status === "Actif"
                            ? "default"
                            : user.status === "En attente"
                            ? "secondary"
                            : "outline"
                        }
                        className="rounded-lg"
                      >
                        {user.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Activity log card ── */}
        <Card className="dashboard-card">
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-foreground">Activité système</h2>
          </div>
          <div className="p-6 pt-2 space-y-5">
            {logs.map((item) => (
              <div
                key={`${item.time}-${item.action}`}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.user}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {item.time}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
