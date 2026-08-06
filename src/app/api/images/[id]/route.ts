import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/images/server-store";
import {
  MediaItemUpdateSchema,
  type MediaItem,
} from "@/lib/images/server-store";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-images-id" });

const REQUEST_TIMEOUT_MS = 60_000;

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS),
    ),
  ]);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  log.debug("GET /api/images/[id]: fetching media item", { id });
  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/images/[id]: validation failed", {
      status: result.response.status,
      id,
    });
    return result.response;
  }

  try {
    const item = await withTimeout(getById(id), `GET /api/images/${id}`);
    if (!item) {
      log.warn("GET /api/images/[id]: media item not found", { id });
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    log.debug("GET /api/images/[id]: media item retrieved", {
      id,
      title: item.title,
    });
    return NextResponse.json({ data: item });
  } catch (error) {
    log.error("GET /api/images/[id]: error fetching media item", { error, id });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch image" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  log.debug("PUT /api/images/[id]: updating media item", { id });
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: MediaItemUpdateSchema,
    validateImageUpload: true,
  });
  if (!result.ok) {
    log.warn("PUT /api/images/[id]: validation failed", {
      status: result.response.status,
      id,
    });
    return result.response;
  }

  const validated = result.ctx.body as Partial<
    Omit<MediaItem, "id" | "createdAt">
  >;

  try {
    const item = await withTimeout(update(id, validated), `PUT /api/images/${id}`);
    if (!item) {
      log.warn("PUT /api/images/[id]: media item not found for update", { id });
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    log.debug("PUT /api/images/[id]: media item updated", {
      id,
      title: item.title,
    });
    return NextResponse.json({ data: item });
  } catch (error) {
    log.error("PUT /api/images/[id]: error updating media item", { error, id });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Erreur serveur lors de la mise à jour" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  log.debug("DELETE /api/images/[id]: deleting media item", { id });
  const result = await validateApiRequest(request, {
    rateLimiter: "procedures",
  });
  if (!result.ok) {
    log.warn("DELETE /api/images/[id]: validation failed", {
      status: result.response.status,
      id,
    });
    return result.response;
  }

  try {
    const success = await withTimeout(remove(id), `DELETE /api/images/${id}`);
    if (!success) {
      log.warn("DELETE /api/images/[id]: media item not found for deletion", {
        id,
      });
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    log.debug("DELETE /api/images/[id]: media item deleted", { id });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    log.error("DELETE /api/images/[id]: error deleting media item", {
      error,
      id,
    });
    if (error instanceof Error && error.message.includes("timeout")) {
      return NextResponse.json(
        { error: "Délai d'attente dépassé. Réessayez." },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete image" },
      { status: 500 },
    );
  }
}
