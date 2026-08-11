"use client";

import { useVoiceGuideContext } from "./voice-guide-provider";
import { Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceGuideTrigger() {
  const { state, activate, deactivate } = useVoiceGuideContext();

  if (!state.active) {
    return (
      <button
        onClick={activate}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-purple-600 text-white shadow-3d-lg",
          "border border-primary/30 hover:-translate-y-1 hover:shadow-primary-glow",
          "transition-all duration-300 active:translate-y-0",
          "animate-glow-pulse"
        )}
        title="Guide vocal intelligent"
      >
        <Mic className="h-6 w-6" />
      </button>
    );
  }

  return (
    <button
      onClick={deactivate}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
        "bg-destructive/90 text-white shadow-3d-lg",
        "border border-destructive/40 hover:-translate-y-1 hover:shadow-destructive/30",
        "transition-all duration-300 active:translate-y-0"
      )}
      title="Arrêter le guide vocal"
    >
      <X className="h-6 w-6" />
    </button>
  );
}
