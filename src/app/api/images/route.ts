import { NextResponse } from "next/server";
import {
  getAll,
  getAllMeta,
  getStats,
  create,
  getCategories,
} from "@/lib/images/server-store";
import { MediaItemInputSchema } from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-images" });

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const REQUEST_TIMEOUT_MS = 30_000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS),
    ),
  ]);
}

export async function GET(request: Request) {
  log.debug("GET /api/images: fetching media items");
  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/images: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT))),
  );
  const offset = (page - 1) * limit;
  const metaOnly = url.searchParams.get("include_data_url") === "false";

  try {
    const [items, categories, stats] = await withTimeout(
      Promise.all([
        metaOnly ? getAllMeta({ limit, offset }) : getAll({ limit, offset }),
        getCategories(),
        getStats(),
      ]),
      "GET /api/images",
    );

    log.debug("GET /api/images: media items retrieved", {
      count: items.length,
      page,
      limit,
      total: stats.total,
    });

    return NextResponse.json({
      data: items,
      meta: {
        categories,
        page,
        limit,
        total: stats.total,
        totalSize: stats.totalSize,
        totalImages: stats.totalImages,
        totalVideos: stats.totalVideos,
        hasMore: page * limit < stats.total,
      },
    });
  } catch (error) {
    log.error("GET /api/images: error fetching media items", { error });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  log.debug("POST /api/images: creating new media item");
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: MediaItemInputSchema,
    validateImageUpload: true,
  });
  if (!result.ok) {
    log.warn("POST /api/images: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const createdItem = await withTimeout(
      create(result.ctx.body as Parameters<typeof create>[0]),
      "POST /api/images",
    );
    log.debug("POST /api/images: media item created", {
      id: createdItem.id,
      title: createdItem.title,
    });
    return NextResponse.json({ data: createdItem }, { status: 201 });
  } catch (error) {
    log.error("POST /api/images: error creating media item", { error });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Erreur serveur lors de la création" },
      { status: 500 },
    );
  }
}
