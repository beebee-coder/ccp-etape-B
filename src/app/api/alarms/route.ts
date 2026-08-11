import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";
import { LocationRefSchema } from "@/lib/location/types";

const log = createLogger({ module: "api-alarms" });

const AlarmSchema = LocationRefSchema.extend({
  code: z.string().min(1),
  type: z.string().min(1),
  severity: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().optional(),
  remedy: z.record(z.unknown()).optional(),
  status: z.string().default("ACTIVE"),
});

export async function GET(request: Request) {
  log.debug("GET /api/alarms: fetching alarms");
  const result = await validateApiRequest(request);
  if (!result.ok) return result.response;

  try {
    const url = new URL(request.url);
    const blocCode = url.searchParams.get("bloc_code");
    const locationType = url.searchParams.get("location_type");
    const locationPath = url.searchParams.get("location_path");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (blocCode) where.blocCode = blocCode;
    if (locationType) where.locationType = locationType;
    if (locationPath) where.locationPath = { startsWith: locationPath };
    if (status) where.status = status;

    const alarms = await prisma.alarm.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: alarms });
  } catch (error) {
    log.error("GET /api/alarms: error", { error });
    return NextResponse.json({ error: "Erreur lors de la récupération des alarmes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  log.debug("POST /api/alarms: creating alarm");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) return authResult.response;

  const result = await validateApiRequest(request, {
    allowedContentTypes: ["application/json"],
    schema: AlarmSchema,
  });
  if (!result.ok) return result.response;

  try {
    const body = result.ctx.body as z.infer<typeof AlarmSchema>;

    const alarm = await prisma.alarm.create({
      data: {
        id: crypto.randomUUID(),
        code: body.code,
        blocCode: body.blocCode || "",
        equipementCode: body.equipementCode || "",
        locationType: body.locationType || "global",
        locationPath: body.locationPath || "",
        groupePath: body.groupePath || null,
        type: body.type,
        severity: body.severity,
        description: body.description,
        condition: body.condition || null,
        remedy: body.remedy as unknown as Prisma.InputJsonValue,
        status: body.status,
        metadata: {},
      },
    });

    return NextResponse.json({ data: alarm }, { status: 201 });
  } catch (error) {
    log.error("POST /api/alarms: error", { error });
    return NextResponse.json({ error: "Erreur lors de la création de l'alarme" }, { status: 400 });
  }
}
