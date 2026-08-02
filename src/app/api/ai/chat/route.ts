import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";
import { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-chat",
    schema: AIChatRequestSchema,
  });
  if (!result.ok) return result.response;

  const { message, context } = result.ctx.body as AIChatRequest;

  try {
    const { response, provider } = await generateAIResponse(
      message.trim(),
      typeof context === "string" ? context : undefined
    );

    return NextResponse.json({
      data: {
        response,
        provider,
      },
    });
  } catch (error) {
    console.error("AI chat route error:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la génération de la réponse" },
      { status: 500 }
    );
  }
}
