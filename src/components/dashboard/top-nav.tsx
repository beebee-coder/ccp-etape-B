"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, LogOut, User, Sun, Moon, Zap, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface DashboardTopNavProps {
  showBackButton?: boolean;
  onMenuClick?: () => void;
}

export function DashboardTopNav({
  showBackButton = false,
  onMenuClick,
}: DashboardTopNavProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <header className="relative flex h-16 items-center justify-between px-4 sm:px-6">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      {/* Top/bottom border gradients */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

      {/* Left side — Breadcrumb / Status */}
      <div className="relative flex items-center gap-3">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className={cn(
              "h-9 w-9 rounded-xl border border-transparent",
              "hover:bg-primary/10 hover:border-primary/20",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
              "active:translate-y-0 active:shadow-none group -ml-1"
            )}
            title="Retour"
          >
            <ArrowLeft className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-colors" />
            <span className="sr-only">Retour</span>
          </Button>
        )}
        {onMenuClick && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className={cn(
              "lg:hidden h-9 w-9 rounded-xl border border-transparent",
              "hover:bg-primary/10 hover:border-primary/20",
              "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
              "active:translate-y-0 active:shadow-none group -ml-1"
            )}
            title="Menu"
          >
            <Menu className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-colors" />
            <span className="sr-only">Menu</span>
          </Button>
        )}
        <div className="flex items-center gap-2 rounded-xl bg-primary/8 border border-primary/15 px-3 py-1.5 shadow-3d-sm">
          <Zap className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary/90 tracking-wide">NexaFlow</span>
        </div>
      </div>

      {/* Right side — Actions */}
      <div className="relative flex items-center gap-1 sm:gap-1.5">

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl border border-transparent",
            "hover:bg-primary/10 hover:border-primary/20",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
            "active:translate-y-0 active:shadow-none group"
          )}
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? (
            <Moon className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-colors duration-200" />
          ) : (
            <Sun className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-all duration-200 group-hover:rotate-45" />
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>

        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-xl border border-transparent",
            "hover:bg-primary/10 hover:border-primary/20",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
            "active:translate-y-0 active:shadow-none group"
          )}
        >
          <Bell className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-colors" />
          {/* Animated badge */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 animate-ping opacity-75" />
            <Badge className="relative h-4 w-4 min-w-4 justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 p-0 text-[9px] font-bold text-white border-0 shadow-primary-glow">
              3
            </Badge>
          </span>
          <span className="sr-only">Notifications</span>
        </Button>

        {/* Profile */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl border border-transparent",
            "hover:bg-primary/10 hover:border-primary/20",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
            "active:translate-y-0 active:shadow-none group"
          )}
          onClick={() => router.push("/profile")}
        >
          <User className="h-4.5 w-4.5 text-foreground/70 group-hover:text-primary transition-colors" />
          <span className="sr-only">Profile</span>
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-9 w-9 rounded-xl border border-transparent",
            "hover:bg-destructive/10 hover:border-destructive/20",
            "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-3d-sm",
            "active:translate-y-0 active:shadow-none group"
          )}
          onClick={() => router.push("/login")}
        >
          <LogOut className="h-4.5 w-4.5 text-foreground/70 group-hover:text-destructive transition-colors" />
          <span className="sr-only">Déconnexion</span>
        </Button>

        {/* Avatar with gradient border */}
        <div className="relative ml-1 flex-shrink-0">
          {/* Animated gradient ring */}
          <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-primary via-purple-500 to-blue-500 opacity-60 animate-tilt blur-sm" />
          <Avatar className="relative h-9 w-9 rounded-xl border-2 border-background shadow-3d-sm">
            <AvatarFallback className="rounded-[10px] text-xs font-bold bg-gradient-to-br from-primary/20 to-purple-500/10 text-primary">
              AD
            </AvatarFallback>
          </Avatar>
          {/* Online dot */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          </span>
        </div>
      </div>
    </header>
  );
}
