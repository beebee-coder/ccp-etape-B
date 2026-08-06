import { NextResponse } from "next/server";
import { saveProcedureExecution, getProcedureExecutions } from "@/lib/procedures/server-store";
import { ProcedureExecutionSchema } from "@/lib/procedures/services/validator.service";
import { validateApiRequest } from "@/lib/api/handlers";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-procedures-executions" });

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const url = new URL(request.url);
  const procedureCode = url.searchParams.get("procedureCode");

  if (!procedureCode) {
    log.warn("GET /api/procedures/executions: missing procedureCode query param");
    return NextResponse.json({ error: "Paramètre procedureCode requis" }, { status: 400 });
  }

  try {
    const executions = await getProcedureExecutions(procedureCode);
    log.info("GET /api/procedures/executions: executions returned", { procedureCode, count: executions.length });
    return NextResponse.json({ data: executions });
  } catch (error) {
    log.error("GET /api/procedures/executions: failed to fetch executions", {
      procedureCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to fetch executions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures-executions",
    schema: ProcedureExecutionSchema,
  });
  if (!result.ok) return result.response;

  const body = result.ctx.body as Parameters<typeof saveProcedureExecution>[0];
  const user = result.ctx.user;

  try {
    const executionId = await saveProcedureExecution(body, user?.sub);
    log.info("POST /api/procedures/executions: execution saved", {
      procedureCode: body.procedureCode,
      status: body.status,
      operatorId: user?.sub ?? null,
      executionId,
    });
    return NextResponse.json({ data: { id: executionId, success: true } }, { status: 201 });
  } catch (error) {
    log.error("POST /api/procedures/executions: failed to save execution", {
      procedureCode: body.procedureCode,
      status: body.status,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to save execution" }, { status: 500 });
  }
}
