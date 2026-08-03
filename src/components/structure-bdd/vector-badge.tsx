"use client";

import { InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface VectorBadgeProps {
  dimension: number;
  vectors: number;
  active?: boolean;
  className?: string;
}

export function VectorBadge({
  dimension,
  vectors,
  active = true,
  className,
}: VectorBadgeProps) {
  return (
    <span
      className={cn(
        "relative inline-flex h-5 w-5 items-center justify-center rounded-full",
        "border border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
        "shadow-[0_0_6px_rgba(34,203,255,0.4)] transition-opacity",
        active ? "opacity-100" : "opacity-30",
        active ? "animate-pulse" : "",
        className,
      )}
      title={`${vectors} vecteurs indexés • dimension ${dimension}`}
      aria-label={`Vectorisé: ${vectors} vecteurs de dimension ${dimension}`}
    >
      <InfinityIcon className="h-2.5 w-2.5" />
      <span className="absolute -inset-0.5 rounded-full border border-cyan-300/30" />
    </span>
  );
}
