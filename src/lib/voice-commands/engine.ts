"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeech } from "@/lib/speech/use-speech";
import { matchVoiceCommand } from "./registry";
import type { VoiceCommandContext } from "./types";
import { speak } from "@/lib/speech/tts-helper";

export interface UseVoiceCommandsOptions {
  onCommandMatched?: (commandId: string, transcript: string) => void;
  onCommandNotFound?: (transcript: string) => void;
  continuous?: boolean;
}

export interface UseVoiceCommandsReturn {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  lastCommand: string | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  processTranscript: (text: string, ctx: VoiceCommandContext) => boolean;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsReturn {
  const {
    onCommandMatched,
    onCommandNotFound,
    continuous = false,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onCommandMatchedRef = useRef(onCommandMatched);
  const onCommandNotFoundRef = useRef(onCommandNotFound);
  const processingRef = useRef(false);

  onCommandMatchedRef.current = onCommandMatched;
  onCommandNotFoundRef.current = onCommandNotFound;

  const {
    isListening,
    startListening,
    stopListening,
    toggleListening,
    transcript: speechTranscript,
    error: speechError,
  } = useSpeech({
    language: "fr-FR",
    continuous,
    interimResults: true,
  });

  useEffect(() => {
    if (speechError) {
      setError(speechError);
    }
  }, [speechError]);

  useEffect(() => {
    if (!speechTranscript) return;
    setTranscript(speechTranscript);
    if (processingRef.current || !continuous) return;

    const result = matchVoiceCommand(speechTranscript, { currentPage: window.location.pathname });
    if (result.matched && result.command) {
      processingRef.current = true;
      setLastCommand(result.command.id);
      onCommandMatchedRef.current?.(result.command.id, speechTranscript);

      const confirmation = `Commande exécutée : ${result.command.description}`;
      setIsSpeaking(true);
      speak(confirmation);

      try {
        result.command.action();
      } catch {
        // action failed silently
      }

      setTimeout(() => {
        setIsSpeaking(false);
        processingRef.current = false;
      }, 1500);
    }
  }, [speechTranscript, continuous]);

  const processTranscript = useCallback(
    (text: string, ctx: VoiceCommandContext): boolean => {
      const result = matchVoiceCommand(text, ctx);
      if (result.matched && result.command) {
        setLastCommand(result.command.id);
        onCommandMatchedRef.current?.(result.command.id, text);
        try {
          result.command.action();
        } catch {
          // action failed silently
        }
        return true;
      }
      return false;
    },
    []
  );

  return {
    isListening,
    isSpeaking,
    transcript,
    lastCommand,
    error,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking: () => {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    },
    processTranscript,
  };
}
