import { NextResponse } from "next/server";
import { getAllQAItems, createQAItem, updateQAItem, deleteQAItem } from "@/lib/q-r/server-store";
import { QAItemCreatePayloadSchema, QAItemUpdatePayloadSchema, type QAItemCreatePayload, type QAItemUpdatePayload } from "@/lib/q-r/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-q-r" });

export async function GET(request: Request) {
  log.debug("GET /api/q-r: fetching all Q/R items");
  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/q-r: validation failed", { status: result.response.status });
    return result.response;
  }

  try {
    const items = await getAllQAItems();
    log.debug("GET /api/q-r: returning items", { count: items.length });
    return NextResponse.json({ data: items });
  } catch (error) {
    log.error("GET /api/q-r: error fetching items", { error });
    return NextResponse.json({ error: "Erreur lors de la récupération des Q/R" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  log.debug("POST /api/q-r: creating new Q/R item");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("POST /api/q-r: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "q-r",
    schema: QAItemCreatePayloadSchema,
  });
  if (!result.ok) {
    log.warn("POST /api/q-r: validation failed", { status: result.response.status });
    return result.response;
  }

  try {
    const created = await createQAItem(result.ctx.body as QAItemCreatePayload, authResult.user!.sub);
    log.debug("POST /api/q-r: item created", { id: created.id });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    log.error("POST /api/q-r: error creating item", { error });
    return NextResponse.json({ error: "Erreur lors de la création du Q/R" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  log.debug("PUT /api/q-r: updating Q/R item");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("PUT /api/q-r: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "q-r",
    schema: QAItemUpdatePayloadSchema,
  });
  if (!result.ok) {
    log.warn("PUT /api/q-r: validation failed", { status: result.response.status });
    return result.response;
  }

  const body = result.ctx.body as QAItemUpdatePayload & { id: string };
  const { id, ...payload } = body;

  if (!id) {
    log.warn("PUT /api/q-r: missing id in body");
    return NextResponse.json({ error: "L'id est requis" }, { status: 400 });
  }

  try {
    const updated = await updateQAItem(id, payload, authResult.user!.sub, true);
    if (!updated) {
      log.warn("PUT /api/q-r: item not found or not authorized", { id });
      return NextResponse.json({ error: "Q/R non trouvé" }, { status: 404 });
    }
    log.debug("PUT /api/q-r: item updated", { id });
    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("PUT /api/q-r: error updating item", { error, id });
    return NextResponse.json({ error: "Erreur lors de la mise à jour du Q/R" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  log.debug("DELETE /api/q-r: deleting Q/R item");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("DELETE /api/q-r: auth failed", { status: authResult.response.status });
    return authResult.response;
  }

  try {
    const body = await request.json();
    const { id } = body as { id: string };

    if (!id) {
      log.warn("DELETE /api/q-r: missing id in body");
      return NextResponse.json({ error: "L'id est requis" }, { status: 400 });
    }

    const deleted = await deleteQAItem(id, authResult.user!.sub, true);
    if (!deleted) {
      log.warn("DELETE /api/q-r: item not found or not authorized", { id });
      return NextResponse.json({ error: "Q/R non trouvé" }, { status: 404 });
    }
    log.debug("DELETE /api/q-r: item deleted", { id });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    log.error("DELETE /api/q-r: error deleting item", { error });
    return NextResponse.json({ error: "Erreur lors de la suppression du Q/R" }, { status: 400 });
  }
}