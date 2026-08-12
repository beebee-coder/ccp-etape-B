import { NextResponse } from "next/server";
import { deleteProcedure } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";
import { registryTreeCache } from "@/lib/api/tree-cache";

const log = createLogger({ module: "api-procedures-code" });

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } },
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const code = params.code;

  try {
    await deleteProcedure(code);
    registryTreeCache.invalidate("tree:");
    log.info("DELETE /api/procedures/[code]: procedure deleted", { code });
    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch (error) {
    log.error("DELETE /api/procedures/[code]: failed to delete procedure", {
      code,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to delete procedure" },
      { status: 500 },
    );
  }
}
