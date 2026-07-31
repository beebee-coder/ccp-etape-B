"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Activity, LayoutDashboard, Plus } from "lucide-react";

export default function ChefDeQuartDashboard() {
  const statCards = [
    { label: "Procédures actives", value: "14" },
    { label: "Exécutions ce mois", value: "312" },
    { label: "Taux de succès", value: "97.4%" },
  ];

  const procedures = ["Ronde matinale", "Contrôle accès", "Point de sécurité"];
  const activities = [
    { title: "Procédure exécutée", detail: "Ronde matinaire", time: "06:00" },
    { title: "Alerte déclenchée", detail: "Accès zone B", time: "05:45" },
    { title: "Membre ajouté", detail: "Rondier Dupont", time: "Hier" },
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
            Espace Chef de Quart
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gérez votre quart, les procédures et l&apos;équipe sous votre responsabilité.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="stat-card">
            <div className="relative">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="mt-2 text-2xl font-bold text-foreground">{stat.value}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Content grid ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ── Procedures card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20">
              <Badge className="h-3.5 w-3.5 rounded-full bg-primary/20 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Procédures du quart</h2>
          </div>
          <div className="mt-4 space-y-4">
            {procedures.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-3 transition-colors hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">Dernière exécution : il y a 2h</p>
                </div>
                <Badge
                  variant="default"
                  className="rounded-lg bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  Actif
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Activity card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/20">
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Activité récente</h2>
          </div>
          <Separator className="my-4" />
          <div className="space-y-4">
            {activities.map((item) => (
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
      <div className="mt-8 flex justify-end">
        <Link href="/creer-procedure">
          <Button
            size="sm"
            className="gap-1.5 btn-primary-gradient"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouvelle procédure
          </Button>
        </Link>
      </div>
    </section>
  );
}
