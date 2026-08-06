import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";
import { generateAIStreamResponse } from "@/lib/ai/providers";
import { getQAItemsForAI } from "@/lib/q-r/server-store";
import { saveChatMessage } from "@/lib/ai/server-store";
import { createLogger } from "@/lib/logger";
import type { ChatMessage } from "@/lib/types/chat";

const log = createLogger({ handler: "ai-chat-stream-route" });

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-stream",
    schema: AIChatRequestSchema,
  });
  if (!result.ok) return result.response;

  const user = result.ctx.user;
  const { message, context, editMode, sessionId } = result.ctx
    .body as AIChatRequest;

  log.debug("AI chat stream request received", {
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
    log.warn(
      "AI chat stream: failed to fetch Q&A context, continuing without it",
      {
        userId: user.sub,
        conversationId,
        error,
      },
    );
  }

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    conversationId,
    userId: user.sub,
    role: "user",
    content: message.trim(),
    timestamp: new Date(),
    source: "actions-ia-stream",
  };

  try {
    await saveChatMessage(userMessage);
  } catch (error) {
    log.warn("AI chat stream: failed to persist user message to database", {
      userId: user.sub,
      conversationId,
      messageId: userMessage.id,
      error,
    });
  }

  try {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        const mapEvent = (e: {
          event: "token" | "done";
          data: { text: string; provider: string };
        }) => sendEvent(e.event, e.data);

        let fullText = "";
        let provider: string | undefined;
        const onEvent = (e: {
          event: "token" | "done";
          data: { text: string; provider: string };
        }) => {
          if (e.event === "token") {
            fullText += e.data.text;
          }
          provider = e.data.provider;
          mapEvent(e);
        };

        try {
          const resultProvider = await generateAIStreamResponse(
            message.trim(),
            onEvent,
            aiContext,
            editMode,
          );
          provider = resultProvider ?? provider;

          if (fullText) {
            const assistantMessage: ChatMessage = {
              id: crypto.randomUUID(),
              conversationId,
              userId: user.sub,
              role: "assistant",
              content: fullText,
              provider,
              timestamp: new Date(),
              source: "actions-ia-stream",
            };

            try {
              await saveChatMessage(assistantMessage);
              log.debug("AI chat stream: assistant message persisted", {
                userId: user.sub,
                conversationId,
                messageId: assistantMessage.id,
                provider,
                contentLength: fullText.length,
              });
            } catch (persistError) {
              log.warn(
                "AI chat stream: failed to persist assistant message to database",
                {
                  userId: user.sub,
                  conversationId,
                  error: persistError,
                },
              );
            }
          }
        } catch (streamError) {
          log.error("AI chat stream: error during stream generation", {
            userId: user.sub,
            conversationId,
            error: streamError,
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    log.error("AI chat stream route error", {
      userId: user.sub,
      conversationId,
      messageLength: message.length,
      editMode,
      error,
    });
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération du flux" },
      { status: 500 },
    );
  }
}
