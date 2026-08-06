import { NextResponse } from "next/server";
import type { z } from "zod";
import {
  AdviceRequestSchema,
  type AdviceRequest,
} from "@/lib/ai/advice-schema";
import { GuidePhase } from "@/lib/procedures/types";
import { generateAIResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";
import { getQAItemsForAI } from "@/lib/q-r/server-store";
import { saveChatMessage } from "@/lib/ai/server-store";
import { createLogger } from "@/lib/logger";
import type { ChatMessage } from "@/lib/types/chat";

const log = createLogger({ handler: "ai-advice-route" });

function formatAdvicePrompt(
  step: z.infer<typeof AdviceRequestSchema>["step"],
  stepIndex: number,
  totalSteps: number,
  phase: GuidePhase,
  userMessage?: string,
  qaContext?: string,
): string {
  const phaseLabels: Record<GuidePhase, string> = {
    briefing: "Briefing (présentation de la procédure)",
    prerequisites: "Vérification des prérequis",
    executing: "Exécution de l'étape",
    completed: "Procédure terminée",
    aborted: "Procédure interrompue",
  };

  const typeLabels: Record<string, string> = {
    consigne_simple: "Consigne simple",
    saisie_donnees: "Saisie de données",
    inspection_visuelle: "Inspection visuelle",
    validation_securite: "Validation de sécurité",
    mesure_numerique: "Mesure numérique",
  };

  const position =
    stepIndex === 0
      ? "Première étape"
      : stepIndex === totalSteps - 1
        ? "Dernière étape"
        : `Étape ${stepIndex + 1} sur ${totalSteps}`;

  const timerInfo =
    step.timerEnabled && step.timerSeconds > 0
      ? `\n- Chronomètre activé : ${Math.floor(step.timerSeconds / 60)} minute(s) maximum`
      : "";

  const mediaInfo =
    step.mediaRequirements.length > 0
      ? `\n- Captures média requises : ${step.mediaRequirements.map((m) => `${m.mandatory ? "[obligatoire]" : "[facultatif]"} ${m.type}`).join(", ")}`
      : "";

  const alarmInfo =
    step.alarms.length > 0
      ? `\n- Alertes configurées :\n${step.alarms.map((a) => `  - [${a.type}] ${a.condition} : ${a.message}`).join("\n")}`
      : "";

  const depInfo =
    step.dependencies.length > 0
      ? `\n- Dépendances : cette étape nécessite la validation des étapes suivantes avant exécution : ${step.dependencies.join(", ")}`
      : "";

  const qaInfo = qaContext ? `\n- Questions fréquentes :\n${qaContext}` : "";

  const basePrompt =
    `Tu es un conseiller IA spécialisé dans les procédures industrielles. Tu aides un opérateur à exécuter une procédure pas à pas.

CONTEXTE ACTUEL :
- Phase : ${phaseLabels[phase]}
- Position : ${position}
- Étape : ${step.title}${step.subtitle ? ` (${step.subtitle})` : ""}
- Type d'étape : ${typeLabels[step.type] || step.type}
- Instructions : ${step.instructions}
- Obligatoire : ${step.isMandatory ? "Oui — cette étape ne peut pas être ignorée" : "Non"}` +
    timerInfo +
    mediaInfo +
    alarmInfo +
    depInfo +
    qaInfo;

  if (userMessage && userMessage.trim().length > 0) {
    return `${basePrompt}

QUESTION DE L'UTILISATEUR :
"${userMessage.trim()}"

Réponds précisément à sa question en te basant sur le contexte de l'étape et de la phase. Sois concis (2-4 phrases maximum), professionnel et direct. Si la question ne concerne pas cette étape, redirige poliment vers le contexte actuel.`;
  }

  return `${basePrompt}

Génère un conseil contextuel court (2-3 phrases) adapté à cette étape et à cette phase. Sois direct, professionnel et opérationnel. Mets en garde si nécessaire sur les points critiques (obligatoire, alarmes, dépendances).`;
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-advice",
    schema: AdviceRequestSchema,
  });
  if (!result.ok) return result.response;

  const user = result.ctx.user;
  const { step, stepIndex, totalSteps, phase, userMessage, context } = result
    .ctx.body as AdviceRequest;

  log.debug("AI advice request received", {
    userId: user.sub,
    stepId: step.id,
    stepIndex,
    totalSteps,
    phase,
    hasUserMessage: !!userMessage,
  });

  const conversationId = crypto.randomUUID();
  const aiContext = typeof context === "string" ? context : undefined;

  let qaContext: string | undefined;
  try {
    qaContext = await getQAItemsForAI();
  } catch (error) {
    log.warn("AI advice: failed to fetch Q&A context", {
      userId: user.sub,
      stepId: step.id,
      error,
    });
  }

  const prompt = formatAdvicePrompt(
    step,
    stepIndex,
    totalSteps,
    phase,
    userMessage,
    qaContext,
  );

  try {
    const { response, provider } = await generateAIResponse(prompt, aiContext);

    log.info("AI advice: response generated", {
      userId: user.sub,
      stepId: step.id,
      phase,
      provider,
      responseLength: response.length,
    });

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      userId: user.sub,
      role: "assistant",
      content: response,
      provider,
      timestamp: new Date(),
      procedureId: undefined,
      source: `ai-advice:${step.id}`,
    };

    try {
      await saveChatMessage(assistantMessage);
      log.debug("AI advice: advice message persisted", {
        userId: user.sub,
        stepId: step.id,
        messageId: assistantMessage.id,
      });
    } catch (error) {
      log.warn("AI advice: failed to persist advice message to database", {
        userId: user.sub,
        stepId: step.id,
        error,
      });
    }

    return NextResponse.json({
      data: {
        stepId: step.id,
        phase,
        message: response,
        provider,
        timestamp: Date.now(),
        conversationId,
      },
    });
  } catch (error) {
    log.error("AI advice route error", {
      userId: user.sub,
      stepId: step.id,
      phase,
      stepIndex,
      totalSteps,
      hasUserMessage: !!userMessage,
      error,
    });
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération du conseil" },
      { status: 500 },
    );
  }
}
