import { NextResponse } from "next/server";
import { getAllProcedures, saveProcedure } from "@/lib/procedures/server-store";
import { ProcedureSchema } from "@/lib/procedures/services/validator.service";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const procedures = await getAllProcedures();
    return NextResponse.json({ data: procedures });
  } catch {
    return NextResponse.json({ error: "Failed to fetch procedures" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: ProcedureSchema,
  });
  if (!result.ok) return result.response;

  try {
    await saveProcedure(result.ctx.body as Parameters<typeof saveProcedure>[0]);
    return NextResponse.json({ data: { success: true } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid procedure" }, { status: 400 });
  }
}
