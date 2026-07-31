"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  ClipboardList,
  Video,
  BookOpen,
  Map,
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
} from "lucide-react";

const quickActions = [
  {
    href: "/chat-ia",
    label: "Chat IA",
    description: "Assistant intelligent pour vos questions",
    icon: MessageSquare,
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/etat-des-lieux",
    label: "État des lieux",
    description: "Points de contrôle et conformité",
    icon: ClipboardList,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    href: "/video-conference",
    label: "Visioconférence",
    description: "Appels et partage d'écran",
    icon: Video,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    href: "/guide-procedure",
    label: "Guide procédure",
    description: "Bonnes pratiques et étapes",
    icon: BookOpen,
    color: "bg-purple-500/10 text-purple-500",
  },
];

const todaysRounds = [
  { id: 1, name: "Ronde entrée principale", time: "06:00", status: "completed" },
  { id: 2, name: "Ronde zone B", time: "10:00", status: "completed" },
  { id: 3, name: "Ronde parking", time: "14:00", status: "pending" },
  { id: 4, name: "Ronde toiture", time: "18:00", status: "pending" },
];

const incidents = [
  { id: 1, title: "Porte défectueuse", detail: "Bloc A - accès 2", time: "13:15", severity: "medium" },
  { id: 2, title: "Éclairage absent", detail: "Parking niveau -1", time: "Hier", severity: "low" },
];

export default function RondierDashboard() {
  const completedRounds = todaysRounds.filter((r) => r.status === "completed").length;

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
            Espace Rondier
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Accédez rapidement à vos outils de rondier et suivez vos missions du jour.
          </p>
        </div>
      </div>

      {/* ── Quick actions grid ── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="group h-full cursor-pointer dashboard-card p-5 transition-all duration-300">
                <div className="relative flex h-full flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative flex h-12 w-12 items-center justify-center rounded-xl shadow-inner transition-transform duration-300",
                      action.color,
                      "group-hover:scale-110 group-hover:shadow-3d"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground flex-1">
                    {action.description}
                  </p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ── Content grid ── */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* ── Today's rounds card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Rondes du jour</h2>
            <Badge
              variant="secondary"
              className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-semibold"
            >
              {completedRounds}/{todaysRounds.length} terminées
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {todaysRounds.map((ronde) => (
              <div
                key={ronde.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border bg-card p-4 transition-all duration-200",
                  ronde.status === "completed"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border/50 hover:bg-muted/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      ronde.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {ronde.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Map className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{ronde.name}</p>
                    <p className="text-xs text-muted-foreground">Planifiée à {ronde.time}</p>
                  </div>
                </div>
                <Badge
                  variant={ronde.status === "completed" ? "default" : "outline"}
                  className={cn(
                    "rounded-lg",
                    ronde.status === "completed"
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      : "border-border/60 text-muted-foreground"
                  )}
                >
                  {ronde.status === "completed" ? "Terminée" : "À faire"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Incidents card ── */}
        <Card className="dashboard-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Incidents à signaler</h2>
            <Badge
              variant="destructive"
              className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-semibold"
            >
              {incidents.length} actif(s)
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {incidents.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-background/50 p-4 transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      item.severity === "high"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-amber-500/10 text-amber-500"
                    )}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="text-xs text-muted-foreground mt-1">Signalé à {item.time}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert(`Signalement de: ${item.title}`)}
                  className="border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
                >
                  Signaler
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
