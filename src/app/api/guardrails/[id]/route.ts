import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    const { id } = await params;
    const result = await query(
      `DELETE FROM guardrail_rules WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    console.error("DELETE /api/guardrails/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (rule !== undefined) {
      sets.push(`rule = $${idx++}`);
      values.push(rule);
    }
    if (section !== undefined) {
      sets.push(`section = $${idx++}`);
      values.push(section);
    }
    if (isActive !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(isActive);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }

    sets.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE guardrail_rules SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, section, rule, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Règle introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    console.error("PUT /api/guardrails/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
