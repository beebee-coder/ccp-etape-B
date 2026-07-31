"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { teams, rolesConfig } from "@/data/teams";

const CalendarIcon = Calendar;

const SHIFT_PATTERN: Record<string, { type: "morning" | "night" | "rest" | "morning_supp" | "night_supp"; day: number }[]> = {
  chef_de_quart: [
    { type: "morning", day: 1 },
    { type: "morning", day: 2 },
    { type: "night", day: 3 },
    { type: "night", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  chef_de_bloc_tg1: [
    { type: "morning", day: 1 },
    { type: "morning", day: 2 },
    { type: "night", day: 3 },
    { type: "night", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  chef_de_bloc_tg2: [
    { type: "night", day: 1 },
    { type: "night", day: 2 },
    { type: "morning", day: 3 },
    { type: "morning", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  rondier_tv: [
    { type: "morning", day: 1 },
    { type: "morning", day: 2 },
    { type: "night", day: 3 },
    { type: "night", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  rondier_post_gaz: [
    { type: "night", day: 1 },
    { type: "night", day: 2 },
    { type: "morning", day: 3 },
    { type: "morning", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  rondier_tg1: [
    { type: "morning", day: 1 },
    { type: "morning", day: 2 },
    { type: "night", day: 3 },
    { type: "night", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
  rondier_tg2: [
    { type: "night", day: 1 },
    { type: "night", day: 2 },
    { type: "morning", day: 3 },
    { type: "morning", day: 4 },
    { type: "rest", day: 5 },
    { type: "rest", day: 6 },
    { type: "rest", day: 7 },
    { type: "rest", day: 8 },
  ],
};

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function MembreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teamId = Number(params.teamId);
  const memberId = Number(params.memberId);
  const team = teams.find((t) => t.id === teamId);
  const member = team?.members_list.find((m) => m.id === memberId);

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [customShifts, setCustomShifts] = useState<Record<number, "morning" | "night" | "rest" | "morning_supp" | "night_supp">>({});
  const [manualHours, setManualHours] = useState(0);
  const [addedHours, setAddedHours] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  if (!team || !member) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="dashboard-card flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Membre introuvable</p>
        </Card>
      </section>
    );
  }

  const roleCfg = rolesConfig[member.role];
  const isChef = member.role === "chef_de_quart" || member.role.startsWith("chef_de_bloc");
  const memberShifts = SHIFT_PATTERN[member.role] ?? [];

  const getShiftType = (day: number) => {
    if (customShifts[day]) return customShifts[day];
    const cyclePosition = ((day - 1) % 8) + 1;
    const shift = memberShifts.find((s) => s.day === cyclePosition);
    return shift?.type ?? "rest";
  };

  const cycleShift = (day: number) => {
    setCustomShifts((prev) => {
      const current = prev[day] ?? getShiftType(day);
      const order: ("morning" | "night" | "rest" | "morning_supp" | "night_supp")[] = [
        "morning",
        "night",
        "rest",
        "morning_supp",
        "night_supp",
      ];
      const idx = order.indexOf(current);
      const next = order[(idx + 1) % order.length];
      return { ...prev, [day]: next };
    });
  };

  const addManualHours = () => {
    setHistory((prev) => [...prev, addedHours]);
    setAddedHours((prev) => prev + manualHours);
    setManualHours(0);
  };

  const restoreLastAction = () => {
    setAddedHours((prev) => {
      const last = history[history.length - 1];
      if (last === undefined) return prev;
      return last;
    });
    setHistory((prev) => prev.slice(0, -1));
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };

  const shiftCounts = (() => {
    let morning = 0;
    let night = 0;
    let morningSupp = 0;
    let nightSupp = 0;
    for (const day of calendarDays) {
      if (!day) continue;
      const type = getShiftType(day);
      if (type === "morning") morning += 1;
      if (type === "night") night += 1;
      if (type === "morning_supp") morningSupp += 1;
      if (type === "night_supp") nightSupp += 1;
    }
    const totalSupp = morningSupp + nightSupp + addedHours;
    return { morning, night, morningSupp, nightSupp, totalSupp };
  })();

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="mb-8 flex items-center gap-3 animate-slide-in-3d">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9 rounded-xl border border-transparent hover:bg-primary/10 hover:border-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm active:translate-y-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="icon-glow">
          <div className="icon-inner h-9 w-9">
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text">
            Fiche membre
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {team.name} · {team.description}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card className="dashboard-card overflow-hidden">
            <div className="border-b border-border/50 px-6 py-4 flex items-center gap-3">
              <div className="relative">
                <div
                  className={cn(
                    "absolute inset-0 rounded-full blur-md",
                    member.status === "active"
                      ? "bg-emerald-500/20"
                      : "bg-muted/20"
                  )}
                />
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full",
                    member.status === "active"
                      ? "bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/20 text-emerald-500"
                      : "bg-muted/30 border-2 border-border/40 text-muted-foreground"
                  )}
                >
                  {member.avatar}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">{member.name}</h2>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rôle</span>
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
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Statut</span>
                <div className="flex items-center gap-1">
                  {member.status === "active" ? (
                    <UserCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <UserX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium text-foreground capitalize">
                    {member.status === "active" ? "Actif" : "Absent"}
                  </span>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Équipe</span>
                <span className="text-xs font-medium text-foreground">{team.name}</span>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Accès rapides
              </p>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
              >
                <Mail className="h-4 w-4 mr-2" />
                Envoyer un email
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
              >
                <Shield className="h-4 w-4 mr-2" />
                Gérer les accès
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start rounded-xl border-border/60 bg-card/60 hover:bg-primary/8 hover:border-primary/30 hover:text-primary transition-all duration-200"
              >
                <Settings className="h-4 w-4 mr-2" />
                Paramètres
              </Button>
            </div>
          </Card>

          <Card className="dashboard-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Compteur
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Matinées supp.</span>
                <Badge
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary border-primary/20"
                >
                  {shiftCounts.morningSupp}
                </Badge>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Nuitées supp.</span>
                <Badge
                  variant="secondary"
                  className="text-xs bg-primary/10 text-primary border-primary/20"
                >
                  {shiftCounts.nightSupp}
                </Badge>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Heures sup. ajout.</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={manualHours}
                    onChange={(e) => setManualHours(Math.max(0, Number(e.target.value)))}
                    className="h-7 w-16 text-right text-xs bg-background/60 border-border/60 rounded-xl focus:border-primary/50 transition-all duration-200"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs btn-primary-gradient"
                    onClick={addManualHours}
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total heures sup.</span>
                <div className="flex items-center gap-1">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-primary/10 text-primary border-primary/20"
                  >
                    {shiftCounts.totalSupp}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary rounded-lg"
                    onClick={restoreLastAction}
                    disabled={history.length === 0}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Total</span>
                <span className="text-xs font-semibold text-foreground">
                  {shiftCounts.morning} matinée{shiftCounts.morning !== 1 ? "s" : ""},{" "}
                  {shiftCounts.night} nuitée{shiftCounts.night !== 1 ? "s" : ""},{" "}
                  {shiftCounts.totalSupp} heure{shiftCounts.totalSupp !== 1 ? "s" : ""} sup.
                </span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="dashboard-card overflow-hidden">
            <div className="border-b border-border/50 px-3 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold text-foreground">Calendrier de quart</h3>
                <Badge
                  variant="secondary"
                  className="text-[8px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20"
                >
                  8j
                </Badge>
              </div>
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-sm p-px">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-primary rounded-sm"
                  onClick={prevMonth}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-[11px] font-semibold text-foreground w-24 text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:text-primary rounded-sm"
                  onClick={nextMonth}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="p-1.5">
              <div className="grid grid-cols-7 mb-0.5">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="text-center">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {day}
                    </span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-px">
                {calendarDays.map((day, idx) => {
                  if (!day) {
                    return (
                      <div key={`empty-${idx}`} className="aspect-square" />
                    );
                  }
                  const shiftType = getShiftType(day);
                  const isTodayDate = isToday(day);

                  const cellBase =
                    "aspect-square rounded-sm flex flex-col items-center justify-center relative transition-all duration-200 cursor-pointer";
                  const cellVariant =
                    shiftType === "morning"
                      ? "bg-sky-500/15 border border-sky-500/30"
                      : shiftType === "night"
                      ? "bg-violet-500/15 border border-violet-500/30"
                      : shiftType === "morning_supp"
                      ? "bg-orange-500/15 border border-orange-500/30"
                      : shiftType === "night_supp"
                      ? "bg-pink-500/15 border border-pink-500/30"
                      : "bg-background border border-transparent hover:border-border";

                  const numberClasses =
                    shiftType === "morning"
                      ? "text-sky-700 font-bold dark:text-sky-300"
                      : shiftType === "night"
                      ? "text-violet-700 font-bold dark:text-violet-300"
                      : shiftType === "morning_supp"
                      ? "text-orange-700 font-bold dark:text-orange-300"
                      : shiftType === "night_supp"
                      ? "text-pink-700 font-bold dark:text-pink-300"
                      : "text-muted-foreground";

                  const badgeClasses =
                    shiftType === "morning"
                      ? "bg-sky-500 text-white"
                      : shiftType === "night"
                      ? "bg-violet-500 text-white"
                      : shiftType === "morning_supp"
                      ? "bg-orange-500 text-white"
                      : shiftType === "night_supp"
                      ? "bg-pink-500 text-white"
                      : "bg-muted text-muted-foreground";

                  const badgeLabel =
                    shiftType === "morning"
                      ? "M"
                      : shiftType === "night"
                      ? "N"
                      : shiftType === "morning_supp"
                      ? "MS"
                      : shiftType === "night_supp"
                      ? "NS"
                      : "R";

                  return (
                    <div
                      key={day}
                      className={`${cellBase} ${cellVariant}`}
                      onDoubleClick={() => cycleShift(day)}
                    >
                      {isTodayDate && (
                        <span className="absolute top-0.5 right-0.5 h-0.5 w-0.5 rounded-full bg-primary shadow-[0_0_4px_rgba(99,102,241,0.8)]" />
                      )}
                      <span
                        className={`text-[11px] leading-none ${numberClasses}`}
                      >
                        {day}
                      </span>
                      <span
                        className={`mt-px text-[8px] font-bold px-px rounded-full ${badgeClasses}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded bg-sky-500/60" />
                  <span className="text-[10px] text-muted-foreground font-medium">Matinée</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded bg-violet-500/60" />
                  <span className="text-[10px] text-muted-foreground font-medium">Nuit</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded bg-orange-500/60" />
                  <span className="text-[10px] text-muted-foreground font-medium">Matinée supp.</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded bg-pink-500/60" />
                  <span className="text-[10px] text-muted-foreground font-medium">Nuit supp.</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded bg-muted border border-border" />
                  <span className="text-[10px] text-muted-foreground font-medium">Repos</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="dashboard-card p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 border border-primary/20">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                Prochaines permissions
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Congé annuel</p>
                  <p className="text-xs text-muted-foreground">
                    Du 15 Août au 22 Août 2026
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                >
                  Planifié
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/50 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Récupération</p>
                  <p className="text-xs text-muted-foreground">10 Septembre 2026</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs border-border/60 text-muted-foreground"
                >
                  En attente
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
