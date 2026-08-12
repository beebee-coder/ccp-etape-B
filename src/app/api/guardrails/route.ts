import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getGuardrailRules() {
  const rules = await prisma.guardrailRule.findMany({
    orderBy: [{ section: "asc" }, { createdAt: "asc" }],
  });
  return rules.map((rule) => ({
    id: rule.id,
    section: rule.section,
    rule: rule.rule,
    isActive: rule.isActive,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  }));
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

    const created = await prisma.guardrailRule.create({
      data: {
        id: crypto.randomUUID(),
        section: section || "general",
        rule: rule.trim(),
      },
    });

    return NextResponse.json({ data: {
      id: created.id,
      section: created.section,
      rule: created.rule,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    }}, { status: 201 });
  } catch (error) {
    console.error("POST /api/guardrails error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
