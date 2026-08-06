import { NextResponse } from "next/server";
import { generateAIResponse, type EditModeResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";
import { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";
import { getQAItemsForAI } from "@/lib/q-r/server-store";
import { saveChatMessage } from "@/lib/ai/server-store";
import { createLogger } from "@/lib/logger";
import type { ChatMessage } from "@/lib/types/chat";

const log = createLogger({ handler: "ai-chat-route" });

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-chat",
    schema: AIChatRequestSchema,
  });
  if (!result.ok) return result.response;

  const user = result.ctx.user;
  const { message, context, editMode, sessionId } = result.ctx
    .body as AIChatRequest;

  log.debug("AI chat request received", {
    userId: user.sub,
    messageLength: message.length,
    editMode,
    sessionId,
  });

  let aiContext = typeof context === "string" ? context : undefined;
  const conversationId = sessionId ?? crypto.randomUUID();

  try {
    const qaContext = await getQAItemsForAI();
    if (qaContext) {
      aiContext = aiContext ? `${aiContext}\n\n${qaContext}` : qaContext;
    }
  } catch (error) {
    log.warn("AI chat: failed to fetch Q&A context, continuing without it", {
      userId: user.sub,
      conversationId,
      error,
    });
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    conversationId,
    userId: user.sub,
    role: "user",
    content: message.trim(),
    timestamp: new Date(),
    source: "actions-ia",
  };

  try {
    await saveChatMessage(userMessage);
  } catch (error) {
    log.warn("AI chat: failed to persist user message to database", {
      userId: user.sub,
      conversationId,
      messageId: userMessage.id,
      error,
    });
  }

  try {
    const aiResult = await generateAIResponse(
      message.trim(),
      aiContext,
      editMode,
    );

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId,
      userId: user.sub,
      role: "assistant",
      content: aiResult.response,
      provider: aiResult.provider,
      timestamp: new Date(),
      source: "actions-ia",
    };

    try {
      await saveChatMessage(assistantMessage);
      log.debug("AI chat: assistant message persisted", {
        userId: user.sub,
        conversationId,
        messageId: assistantMessage.id,
        provider: aiResult.provider,
      });
    } catch (error) {
      log.warn("AI chat: failed to persist assistant message to database", {
        userId: user.sub,
        conversationId,
        messageId: assistantMessage.id,
        error,
      });
    }

    return NextResponse.json({
      data: {
        response: aiResult.response,
        provider: aiResult.provider,
        editMode: editMode || false,
        editResult: editMode ? (aiResult as unknown as EditModeResponse) : null,
        conversationId,
      },
    });
  } catch (error) {
    log.error("AI chat route error", {
      userId: user.sub,
      conversationId,
      messageLength: message.length,
      editMode,
      error,
    });
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération de la réponse" },
      { status: 500 },
    );
  }
}
