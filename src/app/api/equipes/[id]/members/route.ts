import { NextResponse } from "next/server";
import {
  getTeamMembers,
  createTeamMember,
  getTeamById,
} from "@/lib/teams/server-store";
import {
  CreateTeamMemberPayloadSchema,
  type CreateTeamMemberPayload,
} from "@/lib/teams/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-equipes-members" });

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  log.debug("GET /api/equipes/:teamId/members: fetching members", {
    teamId: id,
  });

  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/equipes/:teamId/members: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    if (Number.isNaN(teamId)) {
      log.warn("GET /api/equipes/:teamId/members: invalid teamId", {
        teamId: id,
      });
      return NextResponse.json(
        { error: "ID d'équipe invalide" },
        { status: 400 },
      );
    }

    const teamExists = await getTeamById(teamId);
    if (!teamExists) {
      log.warn("GET /api/equipes/:teamId/members: team not found", { teamId });
      return NextResponse.json(
        { error: "Équipe introuvable" },
        { status: 404 },
      );
    }

    const members = await getTeamMembers(teamId);
    log.debug("GET /api/equipes/:teamId/members: members fetched", {
      teamId,
      count: members.length,
    });
    return NextResponse.json({ data: members });
  } catch (error) {
    log.error("GET /api/equipes/:teamId/members: error fetching members", {
      error,
      teamId: id,
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  log.debug("POST /api/equipes/:teamId/members: creating member");

  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("POST /api/equipes/:teamId/members: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "equipes",
    schema: CreateTeamMemberPayloadSchema,
  });
  if (!result.ok) {
    log.warn("POST /api/equipes/:teamId/members: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    if (Number.isNaN(teamId)) {
      log.warn("POST /api/equipes/:teamId/members: invalid teamId", {
        teamId: id,
      });
      return NextResponse.json(
        { error: "ID d'équipe invalide" },
        { status: 400 },
      );
    }

    const created = await createTeamMember(
      teamId,
      result.ctx.body as CreateTeamMemberPayload,
    );
    if (!created) {
      log.warn("POST /api/equipes/:teamId/members: team not found", { teamId });
      return NextResponse.json(
        { error: "Équipe introuvable" },
        { status: 404 },
      );
    }

    log.debug("POST /api/equipes/:teamId/members: member created", {
      teamId,
      memberId: created.id,
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    log.error("POST /api/equipes/:teamId/members: error creating member", {
      error,
      teamId: id,
    });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
