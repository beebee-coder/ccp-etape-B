"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { TProcedure, TProcedureExecution } from "@/lib/procedures/services/validator.service";
import { GuidePhase, ProcedureExecutionContext } from "@/lib/procedures/types";
import { useProcedureExecution } from "@/lib/procedures/hooks/useProcedureExecution";
import { useVoiceAssistant } from "@/hooks/use-voice-assistant";
import { generateAssistantAdvice } from "@/lib/procedures/assistants/assistant-service";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { BriefingStage } from "./BriefingStage";
import { PrerequisitesStage } from "./PrerequisitesStage";
import { RunningStage } from "./RunningStage";
import { CompletedStage } from "./CompletedStage";
import { AbortedStage } from "./AbortedStage";

interface ProcedureExecutorProps {
  procedure: TProcedure;
  onClose: () => void;
}

function logStructured(level: "log" | "error" | "warn", message: string, data?: unknown): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    module: "ProcedureExecutor",
    message,
    ...(data ? { data } : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

function contextToExecution(
  procedure: TProcedure,
  ctx: ProcedureExecutionContext,
  status: "COMPLETED" | "ABORTED",
): TProcedureExecution {
  const now = Date.now();
  const finishedAt = ctx.finishedAt ?? now;
  return {
    procedureCode: procedure.metadata.code,
    status,
    context: {
      currentStepIndex: ctx.currentStepIndex,
      completedSteps: Array.from(ctx.completedSteps),
      startedAt: ctx.startedAt,
      finishedAt,
      anomalies: ctx.anomalies,
    },
  };
}

async function persistExecution(
  procedure: TProcedure,
  ctx: ProcedureExecutionContext,
  status: "COMPLETED" | "ABORTED",
): Promise<void> {
  const execution = contextToExecution(procedure, ctx, status);
  logStructured("log", "Persisting procedure execution", {
    procedureCode: execution.procedureCode,
    status: execution.status,
    completedSteps: execution.context.completedSteps.length,
    totalSteps: procedure.steps.length,
  });
  await apiClient.post<{ id: string; success: boolean }>("/api/procedures/executions", execution);
  logStructured("log", "Procedure execution persisted", {
    procedureCode: execution.procedureCode,
    status: execution.status,
  });
}

export function ProcedureExecutor({ procedure, onClose }: ProcedureExecutorProps) {
  const {
    phase,
    currentStep,
    currentStepIndex,
    totalSteps,
    completedSteps,
    context,
    timer,
    actions,
  } = useProcedureExecution({
    procedure,
    onComplete: (ctx) => {
      logStructured("log", "Procedure completed", {
        procedureCode: procedure.metadata.code,
        completedSteps: Array.from(ctx.completedSteps).length,
        totalSteps: procedure.steps.length,
        startedAt: ctx.startedAt,
        finishedAt: ctx.finishedAt,
        durationSeconds: ctx.finishedAt
          ? Math.round((ctx.finishedAt - ctx.startedAt) / 1000)
          : undefined,
        anomalies: ctx.anomalies,
      });
    },
    onAbort: (ctx, reason) => {
      logStructured("warn", "Procedure aborted", {
        procedureCode: procedure.metadata.code,
        reason,
        completedSteps: Array.from(ctx.completedSteps).length,
        totalSteps: procedure.steps.length,
        startedAt: ctx.startedAt,
        finishedAt: ctx.finishedAt,
        anomalies: ctx.anomalies,
      });
    },
  });

  const voice = useVoiceAssistant({
    autoRead: true,
    onReadStart: () => {},
    onReadEnd: () => {},
  });

  const isMock =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mock") === "true";

  const [currentAdvice, setCurrentAdvice] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [isSavingExecution, setIsSavingExecution] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveAttemptedRef = useRef(false);

  useEffect(() => {
    if ((phase !== "completed" && phase !== "aborted") || saveAttemptedRef.current) return;
    if (!context) return;

    saveAttemptedRef.current = true;
    setIsSavingExecution(true);
    setSaveError(null);

    const status = phase === "completed" ? "COMPLETED" : "ABORTED";
    persistExecution(procedure, context, status)
      .then(() => {
        logStructured("log", "Procedure execution persisted", {
          procedureCode: procedure.metadata.code,
          status,
        });
      })
      .catch((error) => {
        logStructured("error", "Failed to persist procedure execution", {
          procedureCode: procedure.metadata.code,
          status,
          error: error instanceof Error ? error.message : String(error),
        });
        const message = error instanceof Error ? error.message : "Erreur de sauvegarde";
        setSaveError(message);
        toast.error("Erreur lors de la sauvegarde de l'exécution");
      })
      .finally(() => {
        setIsSavingExecution(false);
      });
  }, [phase, context, procedure]);

  const handleReadAloud = useCallback(() => {
    if (voice.isSpeaking) {
      voice.stopReading();
    } else if (currentStep) {
      voice.readStep(currentStep, currentStepIndex, totalSteps, phase);
    }
  }, [voice, currentStep, currentStepIndex, totalSteps, phase]);

  useEffect(() => {
    if (!currentStep) {
      setCurrentAdvice("");
      return;
    }

    if (isMock) {
      setCurrentAdvice(
        generateAssistantAdvice({
          step: currentStep,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
        })
      );
      return;
    }

    let cancelled = false;
    setAdviceLoading(true);

    apiClient
      .post<{ message: string }>("/api/ai/advice", {
        step: currentStep,
        stepIndex: currentStepIndex,
        totalSteps,
        phase,
      })
      .then((result) => {
        if (!cancelled) {
          setCurrentAdvice(result.message);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentAdvice(
            generateAssistantAdvice({
              step: currentStep,
              stepIndex: currentStepIndex,
              totalSteps,
              phase,
            })
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAdviceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentStep, currentStepIndex, totalSteps, phase, isMock]);

  const handleSendMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!currentStep) return "";

      if (isMock) {
        return generateAssistantAdvice({
          step: currentStep,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
          userMessage: message,
        });
      }

      try {
        const result = await apiClient.post<{ message: string }>("/api/ai/advice", {
          step: currentStep,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
          userMessage: message,
        });
        return result.message;
      } catch {
        return generateAssistantAdvice({
          step: currentStep,
          stepIndex: currentStepIndex,
          totalSteps,
          phase,
          userMessage: message,
        });
      }
    },
    [currentStep, currentStepIndex, totalSteps, phase, isMock]
  );

  const progress =
    totalSteps > 0 ? Math.round(((currentStepIndex + (phase === "completed" ? 1 : 0)) / totalSteps) * 100) : 0;

  const handlePhaseTransition = useCallback(
    (nextPhase: GuidePhase) => {
      actions.setPhase(nextPhase);
      if (nextPhase === "executing" && currentStep) {
        voice.readStep(currentStep, currentStepIndex, totalSteps, nextPhase);
      }
    },
    [actions, voice, currentStep, currentStepIndex, totalSteps]
  );

  if (phase === "briefing") {
    return (
      <BriefingStage
        procedure={procedure}
        onStart={() => handlePhaseTransition("prerequisites")}
      />
    );
  }

  if (phase === "prerequisites") {
    return (
      <PrerequisitesStage
        procedure={procedure}
        onValidate={() => {
          timer.start();
          handlePhaseTransition("executing");
        }}
      />
    );
  }

  if (phase === "completed") {
    return (
      <CompletedStage
        procedure={procedure}
        context={context}
        isSaving={isSavingExecution}
        saveError={saveError}
        onClose={onClose}
      />
    );
  }

  if (phase === "aborted") {
    return (
      <AbortedStage
        procedure={procedure}
        context={context}
        reason={context.anomalies[context.anomalies.length - 1] || "Interruption"}
        isSaving={isSavingExecution}
        saveError={saveError}
        onClose={onClose}
      />
    );
  }

  return (
    <RunningStage
      steps={[...procedure.steps].sort((a, b) => a.order - b.order)}
      currentStepIndex={currentStepIndex}
      completedSteps={completedSteps}
      advice={adviceLoading ? "Chargement du conseil..." : currentAdvice}
      onPrevious={actions.previousStep}
      onNext={actions.nextStep}
      onCompleteStep={actions.completeStep}
      onUncompleteStep={actions.uncompleteStep}
      onSendMessage={handleSendMessage}
      isSpeaking={voice.isSpeaking}
      isAutoRead={true}
      onToggleAutoRead={voice.toggleEnabled}
      onReadAloud={handleReadAloud}
      progress={progress}
    />
  );
}
