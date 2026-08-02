import { NextResponse } from "next/server";
import { getProcedureById, deleteProcedure } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const procedure = await getProcedureById(params.id);
    if (!procedure) {
      return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
    }
    return NextResponse.json({ data: procedure });
  } catch {
    return NextResponse.json({ error: "Failed to fetch procedure" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    await deleteProcedure(params.id);
    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to delete procedure" }, { status: 500 });
  }
}
