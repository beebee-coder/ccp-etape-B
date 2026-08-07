import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
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

    let sql = "SELECT * FROM alarms WHERE 1=1";
    const params: unknown[] = [];
    let idx = 1;

    if (blocCode) {
      sql += ` AND bloc_code = $${idx++}`;
      params.push(blocCode);
    }
    if (locationType) {
      sql += ` AND location_type = $${idx++}`;
      params.push(locationType);
    }
    if (locationPath) {
      sql += ` AND location_path LIKE $${idx++}`;
      params.push(`${locationPath}%`);
    }
    if (status) {
      sql += ` AND status = $${idx++}`;
      params.push(status);
    }

    sql += " ORDER BY created_at DESC";

    const data = await query(sql, params);
    return NextResponse.json({ data: data.rows });
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
    const now = new Date().toISOString();
    const data = await query(
      `INSERT INTO alarms (code, bloc_code, equipement_code, location_type, location_path, groupe_path, type, severity, description, condition, remedy, status, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        body.code,
        body.blocCode,
        body.equipementCode,
        body.locationType,
        body.locationPath,
        body.groupePath || null,
        body.type,
        body.severity,
        body.description,
        body.condition || null,
        body.remedy ? JSON.stringify(body.remedy) : null,
        body.status,
        JSON.stringify({}),
        now,
        now,
      ],
    );

    return NextResponse.json({ data: data.rows[0] }, { status: 201 });
  } catch (error) {
    log.error("POST /api/alarms: error", { error });
    return NextResponse.json({ error: "Erreur lors de la création de l'alarme" }, { status: 400 });
  }
}
