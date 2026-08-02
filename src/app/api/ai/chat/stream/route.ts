import { NextResponse } from "next/server";
import { validateApiRequest } from "@/lib/api/handlers";
import { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";
import { generateAIStreamResponse } from "@/lib/ai/providers";

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-stream",
    schema: AIChatRequestSchema,
  });
  if (!result.ok) return result.response;

  const { message, context } = result.ctx.body as AIChatRequest;

  try {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        const mapEvent = (e: { event: "token" | "done"; data: { text: string; provider: string } }) =>
          sendEvent(e.event, e.data);

        await generateAIStreamResponse(message.trim(), mapEvent, context as string | undefined);
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
    console.error("AI chat stream route error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération du flux" },
      { status: 500 }
    );
  }
}
