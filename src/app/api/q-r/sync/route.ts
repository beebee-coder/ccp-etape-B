import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { validateApiRequest } from "@/lib/api/handlers";
import { createQAItem } from "@/lib/q-r/server-store";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-q-r-sync" });

export async function POST(request: Request) {
  log.debug("POST /api/q-r/sync: syncing Q/R items");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("POST /api/q-r/sync: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "q-r",
  });
  if (!result.ok) {
    log.warn("POST /api/q-r/sync: validation failed", { status: result.response.status });
    return result.response;
  }

  const { items } = result.ctx.body as { items: Array<{ question: string; answer: string }> };

  if (!Array.isArray(items) || items.length === 0) {
    log.warn("POST /api/q-r/sync: no items to sync");
    return NextResponse.json({ error: "Aucun élément à synchroniser" }, { status: 400 });
  }

  try {
    log.debug("POST /api/q-r/sync: processing items", { count: items.length });
    const synced = [];

    for (const item of items) {
      const created = await createQAItem(
        { question: item.question, answer: item.answer },
        authResult.user!.sub
      );
      synced.push({
        id: created.id,
        question: created.question,
        answer: created.answer,
        status: "synced" as const,
      });
    }

    log.debug("POST /api/q-r/sync: sync completed", { count: synced.length });
    return NextResponse.json({
      data: {
        message: `Synchronisation de ${synced.length} paire(s) Q/R réussie`,
        synced,
      },
    });
  } catch (error) {
    log.error("POST /api/q-r/sync: error during sync", { error });
    return NextResponse.json({ error: "Erreur lors de la synchronisation" }, { status: 500 });
  }
}