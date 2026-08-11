"use client";

import { useEffect, useRef } from "react";
import { useVoiceGuideContext } from "./voice-guide-provider";
import {
  Mic,
  MicOff,
  Volume2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function VoiceGuidePanel() {
  const { state, deactivate, nextField, prevField, repeatGuidance, reset, toggleListening } =
    useVoiceGuideContext();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.active && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [state.active]);

  if (!state.active) return null;

  const currentField = state.form?.fields[state.currentFieldIndex];
  const isListening = state.isListening;
  const isSpeaking = state.isSpeaking;
  const isProcessing = state.phase === "processing";
  const totalFields = state.form?.fields.length || 0;
  const hasPrev = state.currentFieldIndex > 0;
  const hasNext = state.currentFieldIndex < totalFields - 1;

  return (
    <div
      ref={panelRef}
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
            <p className="text-xs font-semibold text-foreground">Guide Vocal</p>
            <p className="text-[10px] text-muted-foreground">
              {state.form?.name || "Formulaire détecté"}
            </p>
          </div>
        </div>
        <button
          onClick={deactivate}
          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      {state.form && totalFields > 0 && (
        <div className="px-4 py-2 border-b border-border/40">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progression</span>
            <span>
              {state.currentFieldIndex + 1} / {totalFields}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-purple-600 transition-all duration-500"
              style={{ width: `${((state.currentFieldIndex + 1) / totalFields) * 100}%` }}
            />
          </div>
          <div className="flex gap-1 mt-1.5">
            {state.form.fields.map((field, idx) => (
              <div
                key={field.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  idx <= state.currentFieldIndex
                    ? "bg-primary/60"
                    : "bg-muted/30"
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Current field info */}
      {currentField && (
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Champ actuel
          </p>
          <p className="text-sm font-medium text-foreground">{currentField.label}</p>
          {currentField.required && (
            <span className="inline-block mt-1 text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Obligatoire
            </span>
          )}
        </div>
      )}

      {/* Guidance text */}
      <div className="px-4 py-3 border-b border-border/40 min-h-[60px] flex items-center">
        {isProcessing ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Réflexion...</span>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed">
            {state.guidance || "Prêt à vous guider. Appuyez sur le micro pour commencer."}
          </p>
        )}
      </div>

      {/* Transcript */}
      {state.transcript && (
        <div className="px-4 py-2 border-b border-border/40 bg-primary/5">
          <p className="text-[10px] text-primary/70 mb-0.5">Vous avez dit :</p>
          <p className="text-xs text-foreground italic">&quot;{state.transcript}&quot;</p>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="mx-4 mt-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-xs text-destructive">{state.error}</p>
        </div>
      )}

      {/* Controls */}
      <div className="p-3 space-y-2">
        {/* Main voice control */}
        <button
          onClick={toggleListening}
          disabled={isProcessing}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
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

        {/* Secondary controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevField}
            disabled={!hasPrev || isProcessing}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/8 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Précédent
          </button>

          <button
            onClick={repeatGuidance}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/8 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Répéter
          </button>

          <button
            onClick={nextField}
            disabled={!hasNext || isProcessing}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/60 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/8 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Reset */}
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Réinitialiser le guide
        </button>
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
        {isListening && (
          <span className="flex items-center gap-1 text-[10px] text-red-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            Écoute en cours...
          </span>
        )}
        {isSpeaking && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <Volume2 className="h-3 w-3" />
            Lecture...
          </span>
        )}
        {isProcessing && (
          <span className="flex items-center gap-1 text-[10px] text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Traitement...
          </span>
        )}
        {!isListening && !isSpeaking && !isProcessing && state.guidance && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle2 className="h-3 w-3" />
            Prêt
          </span>
        )}
      </div>
    </div>
  );
}
