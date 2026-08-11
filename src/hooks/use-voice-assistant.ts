"use client";

import { useCallback, useRef, useState } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import { TStep } from "@/lib/procedures/services/validator.service";
import { GuidePhase } from "@/lib/procedures/types";
import { buildStepScript } from "@/lib/procedures/voice-script";

export interface UseVoiceAssistantOptions {
  language?: string;
  autoRead?: boolean;
  onReadStart?: () => void;
  onReadEnd?: () => void;
}

export interface UseVoiceAssistantReturn {
  isEnabled: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  error: string | null;
  toggleEnabled: () => void;
  readStep: (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => void;
  stopReading: () => void;
  readText: (text: string) => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
}

export function useVoiceAssistant({
  language = "fr-FR",
  autoRead = true,
  onReadStart,
  onReadEnd,
}: UseVoiceAssistantOptions = {}): UseVoiceAssistantReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const { speak, stopSpeaking, isSpeaking, isListening, error, startListening, stopListening, toggleListening } =
    useSpeech({ language, continuous: false });
  const autoReadRef = useRef(autoRead);
  autoReadRef.current = autoRead;

  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  const readStep = useCallback(
    (step: TStep, stepIndex: number, totalSteps: number, phase: GuidePhase) => {
      if (!isEnabled) return;
      const script = buildStepScript(step, stepIndex, totalSteps, phase);
      onReadStart?.();
      speak(script);
    },
    [isEnabled, speak, onReadStart]
  );

  const readText = useCallback(
    (text: string) => {
      if (!isEnabled) return;
      onReadStart?.();
      speak(text);
    },
    [isEnabled, speak, onReadStart]
  );

  const stopReading = useCallback(() => {
    stopSpeaking();
    onReadEnd?.();
  }, [stopSpeaking, onReadEnd]);

  return {
    isEnabled,
    isSpeaking,
    isListening,
    error: error || null,
    toggleEnabled,
    readStep,
    stopReading,
    readText,
    startListening,
    stopListening,
    toggleListening,
  };
}
