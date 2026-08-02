import { NextResponse } from "next/server";
import { deleteProcedure } from "@/lib/procedures/server-store";
import { validateApiRequest } from "@/lib/api/handlers";

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    await deleteProcedure(params.code);
    return NextResponse.json({ data: { success: true } }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to delete procedure" }, { status: 500 });
  }
}
