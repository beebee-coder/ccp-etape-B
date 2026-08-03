"use client";

import type { SyncState } from "@/lib/types/structure-bdd";
import { cn } from "@/lib/utils";

const stateConfig: Record<SyncState, { color: string; label: string }> = {
  synced: { color: "bg-emerald-400", label: "Synchronisé" },
  pending: { color: "bg-amber-400", label: "En attente de sync" },
  conflict: { color: "bg-rose-400", label: "Conflit de synchronisation" },
  "local-only": { color: "bg-blue-400", label: "Local uniquement" },
};

interface SyncDotProps {
  state: SyncState;
  showLabel?: boolean;
}

export function SyncDot({ state, showLabel = false }: SyncDotProps) {
  const cfg = stateConfig[state];
  const pulse = state === "synced";
  const warn = state === "conflict";

  return (
    <span
      className="inline-flex items-center justify-center"
      title={cfg.label}
      aria-label={cfg.label}
    >
      <span
        className={cn(
          "relative block h-2.5 w-2.5 rounded-full border border-background shadow-[0_0_6px_rgba(255,255,255,.15)]",
          cfg.color,
          pulse ? "animate-pulse" : "",
          warn ? "animate-bounce" : "",
        )}
      >
        {pulse && (
          <span
            className="absolute -inset-1 rounded-full bg-emerald-300/40"
            aria-hidden="true"
          />
        )}
      </span>
      {showLabel && (
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">
          {cfg.label}
        </span>
      )}
    </span>
  );
}
