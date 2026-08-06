import { NextResponse } from "next/server";
import { getTeamById, updateTeam, deleteTeam } from "@/lib/teams/server-store";
import {
  UpdateTeamPayloadSchema,
  type UpdateTeamPayload,
} from "@/lib/teams/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-equipes-id" });

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  log.debug("GET /api/equipes/:id: fetching team", { id });

  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/equipes/:id: validation failed", {
      id,
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    if (Number.isNaN(teamId)) {
      log.warn("GET /api/equipes/:id: invalid id", { id });
      return NextResponse.json(
        { error: "ID d'équipe invalide" },
        { status: 400 },
      );
    }

    const team = await getTeamById(teamId);
    if (!team) {
      log.debug("GET /api/equipes/:id: team not found", { teamId });
      return NextResponse.json(
        { error: "Équipe introuvable" },
        { status: 404 },
      );
    }

    log.debug("GET /api/equipes/:id: team found", {
      teamId,
      memberCount: team.membersList.length,
    });
    return NextResponse.json({ data: team });
  } catch (error) {
    log.error("GET /api/equipes/:id: error fetching team", { error, id });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.debug("PUT /api/equipes/:id: updating team");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("PUT /api/equipes/:id: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const { id } = await params;
  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "equipes",
    schema: UpdateTeamPayloadSchema,
  });
  if (!result.ok) {
    log.warn("PUT /api/equipes/:id: validation failed", {
      id,
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    if (Number.isNaN(teamId)) {
      log.warn("PUT /api/equipes/:id: invalid id", { id });
      return NextResponse.json(
        { error: "ID d'équipe invalide" },
        { status: 400 },
      );
    }

    const updated = await updateTeam(
      teamId,
      result.ctx.body as UpdateTeamPayload,
    );
    if (!updated) {
      log.warn("PUT /api/equipes/:id: team not found", { teamId });
      return NextResponse.json(
        { error: "Équipe introuvable" },
        { status: 404 },
      );
    }

    log.debug("PUT /api/equipes/:id: team updated", { teamId });
    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error("PUT /api/equipes/:id: error updating team", { error, id });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  log.debug("DELETE /api/equipes/:id: deleting team");
  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("DELETE /api/equipes/:id: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const { id } = await params;
  const result = await validateApiRequest(request, {
    requireAuth: false,
  });
  if (!result.ok) {
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    if (Number.isNaN(teamId)) {
      log.warn("DELETE /api/equipes/:id: invalid id", { id });
      return NextResponse.json(
        { error: "ID d'équipe invalide" },
        { status: 400 },
      );
    }

    const deleted = await deleteTeam(teamId);
    if (!deleted) {
      log.warn("DELETE /api/equipes/:id: team not found", { teamId });
      return NextResponse.json(
        { error: "Équipe introuvable" },
        { status: 404 },
      );
    }

    log.info("DELETE /api/equipes/:id: team deleted", { teamId });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    log.error("DELETE /api/equipes/:id: error deleting team", { error, id });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
