import { NextResponse } from "next/server";
import { generateAIResponse, type EditModeResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";
import { AIChatRequestSchema, type AIChatRequest } from "@/lib/ai/chat-schema";

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-chat",
    schema: AIChatRequestSchema,
  });
  if (!result.ok) return result.response;

  const { message, context, editMode } = result.ctx.body as AIChatRequest;

  try {
    const result = await generateAIResponse(
      message.trim(),
      typeof context === "string" ? context : undefined,
      editMode
    );

    return NextResponse.json({
      data: {
        response: result.response,
        provider: result.provider,
        editMode: editMode || false,
        editResult: editMode ? (result as unknown as EditModeResponse) : null,
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
