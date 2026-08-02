import { NextResponse } from "next/server";
import { getById, update, remove } from "@/lib/etat-des-lieux/server-store";
import { EtatDesLieuxReportSchema, type EtatDesLieuxReport } from "@/lib/etat-des-lieux/server-store";
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
    schema: EtatDesLieuxReportSchema,
    validateImageUpload: true,
  });
  if (!result.ok) return result.response;

  const validated = result.ctx.body as EtatDesLieuxReport;
  const mutable = { ...validated };
  delete (mutable as Partial<Record<string, unknown>>).id;
  delete (mutable as Partial<Record<string, unknown>>).createdAt;

  try {
    const report = await update(params.id, validated as Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ data: report });
  } catch {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
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
