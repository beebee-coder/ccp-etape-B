import { NextResponse } from "next/server";
import { getAllProcedures, saveProcedure } from "@/lib/procedures/server-store";
import { ProcedureSchema } from "@/lib/procedures/services/validator.service";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-procedures" });

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const procedures = await getAllProcedures();
    log.info("GET /api/procedures: procedures retrieved", {
      count: procedures.length,
    });
    return NextResponse.json({ data: procedures });
  } catch (error) {
    log.error("GET /api/procedures: failed to fetch procedures", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch procedures" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: ProcedureSchema,
  });
  if (!result.ok) return result.response;

  const body = result.ctx.body as Parameters<typeof saveProcedure>[0];
  const procedureCode = body?.metadata?.code;

  try {
    await saveProcedure(body);
    log.info("POST /api/procedures: procedure saved", { procedureCode });
    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch (error) {
    log.error("POST /api/procedures: failed to save procedure", {
      procedureCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid procedure" }, { status: 400 });
  }
}
