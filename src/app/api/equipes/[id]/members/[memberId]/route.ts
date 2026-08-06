import { NextResponse } from "next/server";
import {
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
} from "@/lib/teams/server-store";
import {
  UpdateTeamMemberPayloadSchema,
  type UpdateTeamMemberPayload,
} from "@/lib/teams/schemas";
import { validateApiRequest } from "@/lib/api/handlers";
import { requireRole } from "@/lib/api/auth";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-equipes-member-detail" });

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  log.debug("GET /api/equipes/:teamId/members/:memberId: fetching member", {
    teamId: id,
    memberId,
  });

  const result = await validateApiRequest(request);
  if (!result.ok) {
    log.warn("GET /api/equipes/:teamId/members/:memberId: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    const parsedMemberId = parseInt(memberId, 10);

    if (Number.isNaN(teamId) || Number.isNaN(parsedMemberId)) {
      log.warn("GET /api/equipes/:teamId/members/:memberId: invalid ids", {
        teamId: id,
        memberId,
      });
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const member = await getTeamMemberById(teamId, parsedMemberId);
    if (!member) {
      log.debug(
        "GET /api/equipes/:teamId/members/:memberId: member not found",
        { teamId, parsedMemberId },
      );
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    log.debug("GET /api/equipes/:teamId/members/:memberId: member found", {
      teamId,
      memberId: parsedMemberId,
    });
    return NextResponse.json({ data: member });
  } catch (error) {
    log.error(
      "GET /api/equipes/:teamId/members/:memberId: error fetching member",
      { error, teamId: id, memberId },
    );
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  log.debug("PUT /api/equipes/:teamId/members/:memberId: updating member", {
    teamId: id,
    memberId,
  });

  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("PUT /api/equipes/:teamId/members/:memberId: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
    allowedContentTypes: ["application/json"],
    rateLimiter: "equipes",
    schema: UpdateTeamMemberPayloadSchema,
  });
  if (!result.ok) {
    log.warn("PUT /api/equipes/:teamId/members/:memberId: validation failed", {
      status: result.response.status,
    });
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    const parsedMemberId = parseInt(memberId, 10);

    if (Number.isNaN(teamId) || Number.isNaN(parsedMemberId)) {
      log.warn("PUT /api/equipes/:teamId/members/:memberId: invalid ids", {
        teamId: id,
        memberId,
      });
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const updated = await updateTeamMember(
      teamId,
      parsedMemberId,
      result.ctx.body as UpdateTeamMemberPayload,
    );
    if (!updated) {
      log.warn("PUT /api/equipes/:teamId/members/:memberId: member not found", {
        teamId,
        memberId: parsedMemberId,
      });
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    log.debug("PUT /api/equipes/:teamId/members/:memberId: member updated", {
      teamId,
      memberId: parsedMemberId,
    });
    return NextResponse.json({ data: updated });
  } catch (error) {
    log.error(
      "PUT /api/equipes/:teamId/members/:memberId: error updating member",
      { error, teamId: id, memberId },
    );
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  log.debug("DELETE /api/equipes/:teamId/members/:memberId: deleting member", {
    teamId: id,
    memberId,
  });

  const authResult = await requireRole(request, ["admin"]);
  if (authResult.response) {
    log.warn("DELETE /api/equipes/:teamId/members/:memberId: auth failed", {
      status: authResult.response.status,
    });
    return authResult.response;
  }

  const result = await validateApiRequest(request, {
    requireAuth: false,
  });
  if (!result.ok) {
    return result.response;
  }

  try {
    const teamId = parseInt(id, 10);
    const parsedMemberId = parseInt(memberId, 10);

    if (Number.isNaN(teamId) || Number.isNaN(parsedMemberId)) {
      log.warn("DELETE /api/equipes/:teamId/members/:memberId: invalid ids", {
        teamId: id,
        memberId,
      });
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const deleted = await deleteTeamMember(teamId, parsedMemberId);
    if (!deleted) {
      log.warn(
        "DELETE /api/equipes/:teamId/members/:memberId: member not found",
        { teamId, memberId: parsedMemberId },
      );
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    log.info("DELETE /api/equipes/:teamId/members/:memberId: member deleted", {
      teamId,
      memberId: parsedMemberId,
    });
    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    log.error(
      "DELETE /api/equipes/:teamId/members/:memberId: error deleting member",
      { error, teamId: id, memberId },
    );
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
