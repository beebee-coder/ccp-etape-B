"use client";

import { useState, useCallback } from "react";
import { useVoiceCommands } from "@/lib/voice-commands/engine";
import { Mic, MicOff, Volume2, X, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const handleCommandMatched = useCallback((commandId: string) => {
    setLastCommand(commandId);
    setTimeout(() => setLastCommand(null), 3000);
  }, []);

  const handleCommandNotFound = useCallback(() => {
    // no-op in palette
  }, []);

  const {
    isListening,
    isSpeaking,
    transcript,
    error,
    startListening,
    stopListening,
  } = useVoiceCommands({
    onCommandMatched: handleCommandMatched,
    onCommandNotFound: handleCommandNotFound,
    continuous: true,
  });

  const handleToggle = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full",
          "bg-gradient-to-br from-primary to-purple-600 text-white shadow-3d-lg",
          "border border-primary/30 hover:-translate-y-1 hover:shadow-primary-glow",
          "transition-all duration-300 active:translate-y-0",
          isListening && "animate-glow-pulse"
        )}
        title="Commandes vocales"
      >
        {isListening ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </button>

      {/* Command palette panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50 w-80 rounded-2xl border shadow-3d-lg backdrop-blur-xl",
            "bg-background/95 border-border/60",
            "animate-slide-in-3d"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md" />
                <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/10 border border-primary/20">
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Commandes Vocales</p>
                <p className="text-[10px] text-muted-foreground">
                  {isListening ? "Écoute en cours..." : "Prêt"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Main controls */}
          <div className="p-3 space-y-3">
            <button
              onClick={handleToggle}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all duration-200",
                isListening
                  ? "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20"
                  : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/40"
              )}
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Arrêter l&apos;écoute
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Parler
                </>
              )}
            </button>

            {/* Last command feedback */}
            {lastCommand && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-xs text-emerald-700">Commande exécutée : {lastCommand}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Live transcript */}
            {transcript && (
              <div className="rounded-lg border border-border/40 bg-primary/5 px-3 py-2">
                <p className="text-[10px] text-primary/70 mb-0.5">Vous avez dit :</p>
                <p className="text-xs text-foreground italic">&quot;{transcript}&quot;</p>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
            {isListening && (
              <span className="flex items-center gap-1 text-[10px] text-red-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                Écoute...
              </span>
            )}
            {isSpeaking && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Volume2 className="h-3 w-3" />
                Lecture...
              </span>
            )}
            {!isListening && !isSpeaking && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                En veille
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
