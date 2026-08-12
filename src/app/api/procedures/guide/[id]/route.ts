import { NextResponse } from "next/server";
import {
  getProcedureById,
  deleteProcedure,
} from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import { registryTreeCache } from "@/lib/api/tree-cache";

const log = createLogger({ module: "api-procedures-guide-id" });

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const id = params.id;

  try {
    const procedure = await getProcedureById(id);
    if (!procedure) {
      log.warn("GET /api/procedures/guide/[id]: procedure not found", { id });
      return NextResponse.json(
        { error: "Procedure not found" },
        { status: 404 },
      );
    }
    log.info("GET /api/procedures/guide/[id]: procedure fetched", { id });
    return NextResponse.json({ data: procedure });
  } catch (error) {
    log.error("GET /api/procedures/guide/[id]: failed to fetch procedure", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch procedure" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const id = params.id;

  try {
    await deleteProcedure(id);
    registryTreeCache.invalidate("tree:");
    log.info("DELETE /api/procedures/guide/[id]: procedure deleted", { id });
    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error) {
    log.error("DELETE /api/procedures/guide/[id]: failed to delete procedure", {
      id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete procedure" },
      { status: 500 },
    );
  }
}
