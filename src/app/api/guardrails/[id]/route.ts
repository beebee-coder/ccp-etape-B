import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    const { id } = await params;
    await prisma.guardrailRule.delete({
      where: { id },
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/guardrails/:id error:", error);
    return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { rule, section, isActive } = body;

    const data: Record<string, unknown> = {};
    if (rule !== undefined) data.rule = rule;
    if (section !== undefined) data.section = section;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await prisma.guardrailRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({ data: {
      id: updated.id,
      section: updated.section,
      rule: updated.rule,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }});
  } catch (error) {
    console.error("PUT /api/guardrails/:id error:", error);
    return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
  }
}
