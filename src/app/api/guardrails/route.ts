import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getGuardrailRules() {
  const result = await query(
    `SELECT id, section, rule, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
     FROM guardrail_rules
     ORDER BY section ASC, created_at ASC`
  );
  return result.rows;
}

export async function GET() {
  try {
    const rules = await getGuardrailRules();
    return NextResponse.json({ data: rules });
  } catch (error) {
    console.error("GET /api/guardrails error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) return authResult.response;

  try {
    const body = await request.json();
    const { rule, section } = body;

    if (!rule || typeof rule !== "string" || rule.trim().length === 0) {
      return NextResponse.json({ error: "Le champ 'rule' est requis" }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO guardrail_rules (section, rule)
       VALUES ($1, $2)
       RETURNING id, section, rule, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [section || "general", rule.trim()]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/guardrails error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
