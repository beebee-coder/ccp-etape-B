import { NextResponse } from "next/server";
import { getAllTeams, createTeam } from "@/lib/teams/server-store";
import {
  CreateTeamPayloadSchema,
  type CreateTeamPayload,
} from "@/lib/teams/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-equipes" });

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  log.debug("GET /api/equipes: fetching all teams");
  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/equipes: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teams = await getAllTeams();
    log.debug("GET /api/equipes: teams fetched", { count: teams.length });
    return NextResponse.json({ data: teams });
  } catch (error) {
    log.error("GET /api/equipes: error fetching teams", { error });
    return NextResponse.json(
      { error: "Erreur lors de la récupération des équipes" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  log.debug("POST /api/equipes: creating new team");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("POST /api/equipes: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "equipes",
    schema: CreateTeamPayloadSchema,
  });
  if (!result.ok) {
    log.warn("POST /api/equipes: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const created = await createTeam(result.ctx.body as CreateTeamPayload);
    log.debug("POST /api/equipes: team created", { id: created.id });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    log.error("POST /api/equipes: error creating team", { error });
    return NextResponse.json(
      { error: "Erreur lors de la création de l'équipe" },
      { status: 400 },
    );
  }
}
