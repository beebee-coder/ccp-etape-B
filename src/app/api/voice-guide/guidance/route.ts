import { NextResponse } from "next/server";
import { generateAIResponse } from "@/lib/ai/providers";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ handler: "voice-guide-guidance" });

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "ai-chat",
  });
  if (!result.ok) return result.response;

  try {
    const body = await request.json();
    const { prompt, context } = body as { prompt: string; context?: string };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt requis" }, { status: 400 });
    }

    log.debug("Voice guide guidance request received", {
      userId: result.ctx.user.sub,
      promptLength: prompt.length,
    });

    const aiResponse = await generateAIResponse(prompt, context);

    return NextResponse.json({ guidance: aiResponse.response });
  } catch (error) {
    log.error("Voice guide guidance error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erreur lors de la génération du guide vocal" },
      { status: 500 }
    );
  }
}
