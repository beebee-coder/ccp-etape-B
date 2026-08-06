import { NextResponse } from "next/server";
import { getAll, create } from "@/lib/rapports/server-store";
import { ReportInputSchema } from "@/lib/types/reports";
import { validateApiRequest } from "@/lib/api/handlers";

export async function GET(request: Request) {
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const reports = await getAll();
    return NextResponse.json({ data: reports });
  } catch {
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    rateLimiter: "procedures",
    schema: ReportInputSchema,
  });
  if (!result.ok) return result.response;

  try {
    const created = await create(result.ctx.body as Parameters<typeof create>[0]);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }
}