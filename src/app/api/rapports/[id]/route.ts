import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/rapports/server-store";
import { ReportSchema, type Report } from "@/lib/types/reports";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const report = await getById(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({ data: report });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    schema: ReportSchema,
  });
  if (!result.ok) return result.response;

  const validated = result.ctx.body as Report;
  const mutable = { ...validated };
  delete (mutable as Partial<Record<string, unknown>>).id;
  delete (mutable as Partial<Record<string, unknown>>).createdAt;
  delete (mutable as Partial<Record<string, unknown>>).updatedAt;

  try {
    const report = await update(params.id, validated as Partial<Omit<Report, "id" | "createdAt" | "updatedAt">>);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ data: report });
  } catch {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  const success = await remove(params.id);
  if (!success) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  return NextResponse.json({ data: { success: true } });
}