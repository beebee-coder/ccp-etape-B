"use client";

import { type ReactNode } from "react";
import { VoiceGuideContext } from "./voice-guide-provider";
import { VoiceGuidePanel } from "./voice-guide-panel";
import { VoiceGuideTrigger } from "./voice-guide-trigger";
import { useVoiceGuide } from "@/lib/voice-guide/orchestrator";

export function VoiceGuideProvider({ children }: { children: ReactNode }) {
  const voiceGuide = useVoiceGuide();

  return (
    <VoiceGuideContext.Provider value={voiceGuide}>
      {children}
      <VoiceGuideTrigger />
      <VoiceGuidePanel />
    </VoiceGuideContext.Provider>
  );
}
