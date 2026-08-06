import { NextResponse } from "next/server";
import { getStats } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-images-summary" });

const REQUEST_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS),
    ),
  ]);
}

export async function GET(request: Request) {
  log.debug("GET /api/images/summary: fetching aggregate stats");
  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/images/summary: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const stats = await withTimeout(getStats(), "GET /api/images/summary");
    log.debug("GET /api/images/summary: stats retrieved", {
      total: stats.total,
      totalSize: stats.totalSize,
    });
    return NextResponse.json({ data: stats });
  } catch (error) {
    log.error("GET /api/images/summary: error fetching stats", { error });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch image stats" },
      { status: 500 },
    );
  }
}
