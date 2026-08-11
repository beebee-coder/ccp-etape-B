"use client";

import { createContext, useContext } from "react";
import type { VoiceGuideState } from "@/lib/voice-guide/types";

export interface VoiceGuideContextValue {
  state: VoiceGuideState;
  activate: () => Promise<void>;
  deactivate: () => void;
  startGuidance: () => Promise<void>;
  nextField: () => Promise<void>;
  prevField: () => Promise<void>;
  repeatGuidance: () => Promise<void>;
  reset: () => void;
  toggleListening: () => void;
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
}

export const VoiceGuideContext = createContext<VoiceGuideContextValue | null>(null);

export function useVoiceGuideContext(): VoiceGuideContextValue {
  const context = useContext(VoiceGuideContext);
  if (!context) {
    throw new Error("useVoiceGuideContext must be used within VoiceGuideProvider");
  }
  return context;
}
