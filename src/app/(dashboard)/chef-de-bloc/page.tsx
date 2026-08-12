"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { LayoutDashboard, Plus, Users, BarChart3, AlertCircle } from "lucide-react";

export default function ChefDeBlocDashboard() {
  const statCards = [
    { label: "Blocs supervisés", value: "3", icon: BarChart3 },
    { label: "Chefs de quart", value: "6", icon: Users },
    { label: "Taux de conformité", value: "94.1%", icon: BarChart3 },
  ];

  const blocs = [
    { name: "Bloc A - Entrée", count: "1 chef de quart · 4 procédures", status: "Opérationnel" },
    { name: "Bloc B - Production", count: "1 chef de quart · 4 procédures", status: "Opérationnel" },
    { name: "Bloc C - Stockage", count: "1 chef de quart · 4 procédures", status: "Maintenance" },
  ];

  const alerts = [
    { title: "Incident résolu", detail: "Bloc B - accès refusé", time: "14:20" },
    { title: "Alerte maintenance", detail: "Bloc C - planning", time: "11:05" },
    { title: "Rapport généré", detail: "Point quotidien", time: "09:00" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-4 animate-slide-in-3d">
        <div className="icon-glow">
          <div className="icon-inner">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Espace Chef de Bloc
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Supervisez les blocs, coordonnez les équipes et suivez les procédures globales.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="stat-card">
              <div className="relative flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
              </div>
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Content grid ── */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Blocs card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Vue par bloc</h2>
          </div>
          <div className="mt-4 space-y-4">
            {blocs.map((bloc) => (
              <div
                key={bloc.name}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-3 transition-colors hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{bloc.name}</p>
                  <p className="text-xs text-muted-foreground">{bloc.count}</p>
                </div>
                <Badge
                  variant={bloc.status === "Opérationnel" ? "default" : "secondary"}
                  className={cn(
                    "rounded-lg",
                    bloc.status === "Opérationnel"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  )}
                >
                  {bloc.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Alerts card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Alertes et incidents</h2>
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            {alerts.map((item) => (
              <div
                key={item.title}
                className="flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Create action ── */}
      <div className="mt-8 flex flex-col sm:flex-row sm:justify-end gap-3">
        <Link href="/creer-procedure">
          <Button className="gap-1.5 btn-primary-gradient">
            <Plus className="h-3.5 w-3.5" />
            Nouvelle procédure
          </Button>
        </Link>
      </div>
    </section>
  );
}
