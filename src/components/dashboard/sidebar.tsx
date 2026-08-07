"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  HelpCircle,
  FileText,
  MessageSquare,
  BookOpen,
  Image,
  Database,
  Video,
  BarChart3,
  Users,
  ClipboardList,
  Bot,
  GitBranch,
  Menu,
  LayoutPanelLeft,
} from "lucide-react";
import { NexaFlowLogo } from "@/components/brand/nexaflow-logo";
import { useSidebar } from "./sidebar-provider";

const navItems = [
  {
    href: "/admin",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    roles: ["admin"],
  },
  {
    href: "/chef-de-quart",
    label: "Mon espace",
    icon: LayoutDashboard,
    roles: ["chef-de-quart"],
  },
  {
    href: "/chef-de-bloc",
    label: "Mon espace",
    icon: LayoutDashboard,
    roles: ["chef-de-bloc"],
  },
  {
    href: "/rondier",
    label: "Mon espace",
    icon: LayoutDashboard,
    roles: ["rondier"],
  },
  { href: "/q-r", label: "Q/R", icon: HelpCircle, roles: ["admin"] },
  { href: "/actions-ia", label: "Actions IA", icon: Bot, roles: ["admin"] },
  {
    href: "/admin/pipeline",
    label: "Pipeline",
    icon: GitBranch,
    roles: ["admin"],
  },
  {
    href: "/creer-procedure",
    label: "Créer une procédure",
    icon: FileText,
    roles: ["admin", "chef-de-quart"],
  },
  {
    href: "/guide-procedure",
    label: "Guide procédure",
    icon: BookOpen,
    roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"],
  },
  {
    href: "/structure-bdd",
    label: "Structure BDD",
    icon: Database,
    roles: ["admin"],
  },
  { href: "/images", label: "Banque d'images", icon: Image, roles: ["admin"] },
  {
    href: "/video-conference",
    label: "Visioconférence",
    icon: Video,
    roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"],
  },
  {
    href: "/rapports",
    label: "Rapports",
    icon: BarChart3,
    roles: ["admin", "chef-de-quart"],
  },
  {
    href: "/equipes",
    label: "Équipes",
    icon: Users,
    roles: ["admin", "chef-de-quart"],
  },
  {
    href: "/etat-des-lieux",
    label: "État des lieux",
    icon: ClipboardList,
    roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"],
  },
  {
    href: "/chat-ia",
    label: "Chat IA",
    icon: MessageSquare,
    roles: ["admin", "chef-de-quart", "chef-de-bloc", "rondier"],
  },
];

export function DashboardSidebar({
  role,
}: {
  role: "admin" | "chef-de-quart" | "chef-de-bloc" | "rondier";
}) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const items = navItems.filter(
    (item) =>
      item.roles.includes(role) &&
      !(
        process.env.NODE_ENV === "production" && item.href === "/admin/pipeline"
      ),
  );

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/admin" &&
      href !== "/chef-de-quart" &&
      href !== "/chef-de-bloc" &&
      href !== "/rondier" &&
      pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col overflow-hidden transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* 3D Background with gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-sidebar via-sidebar to-sidebar/95" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none" />

      {/* Top edge glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Right border with gradient */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

      {/* ── Logo Header ── */}
      <div className="relative flex h-16 items-center gap-3 px-5">
        {!collapsed && (
          <>
            {/* Animated logo glow background */}
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md animate-glow-pulse" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shadow-3d-sm">
                <NexaFlowLogo className="h-5 w-5" />
              </div>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground gradient-text">
                NexaFlow
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                  Opérationnel
                </span>
              </div>
            </div>
          </>
        )}

        {collapsed && (
          <div className="absolute inset-0 flex justify-center pt-4">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20 shadow-3d-sm">
              <NexaFlowLogo className="h-4 w-4" />
            </div>
          </div>
        )}

        {/* Collapse toggle at the far right */}
        <button
          type="button"
          onClick={toggle}
          aria-label={
            collapsed
              ? "Développer la barre latérale"
              : "Réduire la barre latérale"
          }
          title={collapsed ? "Développer" : "Réduire"}
          className={cn(
            "absolute top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg",
            "border border-border/30 bg-background/60 text-sidebar-foreground/60",
            "hover:border-primary/40 hover:text-primary hover:bg-background",
            "transition-all duration-200 hover:scale-105",
            collapsed ? "right-2" : "right-3",
          )}
        >
          {collapsed ? (
            <LayoutPanelLeft className="h-3.5 w-3.5" />
          ) : (
            <Menu className="h-3.5 w-3.5" />
          )}
        </button>

        {/* Header bottom separator */}
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── Navigation ── */}
      <nav className="relative flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-none">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ animationDelay: `${idx * 40}ms` }}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                "transition-all duration-200 ease-out",
                "animate-slide-in-3d",
                collapsed && "justify-center px-2",
                active
                  ? [
                      "bg-gradient-to-r from-primary/15 to-primary/5",
                      "text-primary shadow-3d-sm",
                      "border border-primary/20",
                      "nav-active-indicator",
                    ].join(" ")
                  : [
                      "text-sidebar-foreground/65 border border-transparent",
                      "hover:bg-gradient-to-r hover:from-primary/8 hover:to-transparent",
                      "hover:text-sidebar-foreground hover:border-border/40",
                      "hover:translate-x-1 hover:shadow-3d-sm",
                    ].join(" "),
              )}
            >
              {/* Active glow dot */}
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-0.5 h-5 w-0.5 rounded-r bg-primary shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" />
              )}

              {/* Icon container */}
              <div
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                  collapsed && "h-8 w-8",
                  active
                    ? "bg-primary/20 shadow-inner"
                    : "group-hover:bg-primary/10",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 transition-all duration-200",
                    active
                      ? "text-primary"
                      : "text-sidebar-foreground/50 group-hover:text-primary/70",
                  )}
                />
              </div>

              {!collapsed && <span className="truncate">{item.label}</span>}

              {/* Active indicator dot on the right */}
              {active && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(99,102,241,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
