import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import type {
  TeamInfo,
  TeamMember,
  CreateTeamPayload,
  CreateTeamMemberPayload,
  UpdateTeamPayload,
  UpdateTeamMemberPayload,
  TeamMemberStatus,
} from "@/lib/teams/schemas";

const log = createLogger({ module: "teams-server-store" });

function rowToTeamMember(row: Prisma.TeamMemberGetPayload<object>): TeamMember {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    email: row.email || undefined,
    role: row.role,
    status: row.status as TeamMemberStatus,
    avatar: row.avatar,
  };
}

function rowToTeam(row: Prisma.TeamGetPayload<{ include: { members: true } }>): TeamInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    color: row.color,
    members: row.members.length,
    membersList: row.members.map(rowToTeamMember),
  };
}

export async function getAllTeams(): Promise<TeamInfo[]> {
  log.debug("getAllTeams: fetching all teams with members");
  const teams = await prisma.team.findMany({
    include: {
      members: {
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  log.debug("getAllTeams: teams fetched", { count: teams.length });
  return teams.map(rowToTeam);
}

export async function getTeamById(id: number): Promise<TeamInfo | null> {
  log.debug("getTeamById: fetching team", { id });
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!team) {
    log.debug("getTeamById: team not found", { id });
    return null;
  }

  const info = rowToTeam(team);
  log.debug("getTeamById: team found", { id, memberCount: info.membersList.length });
  return info;
}

export async function createTeam(
  payload: CreateTeamPayload,
): Promise<TeamInfo> {
  log.info("createTeam: creating new team", {
    name: payload.name,
    description: payload.description,
    memberCount: payload.members?.length ?? 0,
  });

  const team = await prisma.team.create({
    data: {
      name: payload.name,
      description: payload.description,
      color: payload.color,
      members: {
        create: payload.members?.map((member) => ({
          name: member.name,
          email: member.email,
          role: member.role,
          status: member.status,
          avatar: member.avatar,
        })) ?? [],
      },
    },
    include: {
      members: {
        orderBy: { name: "asc" },
      },
    },
  });

  const info = rowToTeam(team);
  log.info("createTeam: team created successfully", {
    teamId: team.id,
    name: payload.name,
  });
  return info;
}

export async function updateTeam(
  id: number,
  payload: UpdateTeamPayload,
): Promise<TeamInfo | null> {
  log.debug("updateTeam: updating team", { id, payload });

  const data: Prisma.TeamUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description;
  if (payload.color !== undefined) data.color = payload.color;

  const team = await prisma.team.update({
    where: { id },
    data,
    include: {
      members: {
        orderBy: { name: "asc" },
      },
    },
  });

  log.debug("updateTeam: team updated", { id });
  return rowToTeam(team);
}

export async function deleteTeam(id: number): Promise<boolean> {
  log.info("deleteTeam: deleting team", { id });
  try {
    await prisma.team.delete({
      where: { id },
    });

    log.info("deleteTeam: team deleted", { id });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      log.warn("deleteTeam: team not found", { id });
      return false;
    }
    log.error("deleteTeam: failed to delete team", { id, error });
    throw error;
  }
}

export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  log.debug("getTeamMembers: fetching members", { teamId });
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    orderBy: { name: "asc" },
  });

  log.debug("getTeamMembers: members fetched", {
    teamId,
    count: members.length,
  });
  return members.map(rowToTeamMember);
}

export async function getTeamMemberById(
  teamId: number,
  memberId: number,
): Promise<TeamMember | null> {
  log.debug("getTeamMemberById: fetching member", { teamId, memberId });
  const member = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
  });

  if (!member) {
    log.debug("getTeamMemberById: member not found", { teamId, memberId });
    return null;
  }

  log.debug("getTeamMemberById: member found", { teamId, memberId });
  return rowToTeamMember(member);
}

export async function createTeamMember(
  teamId: number,
  payload: CreateTeamMemberPayload,
): Promise<TeamMember | null> {
  log.info("createTeamMember: creating member", { teamId, name: payload.name });

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true },
  });
  if (!team) {
    log.warn("createTeamMember: team not found", { teamId });
    return null;
  }

  const member = await prisma.teamMember.create({
    data: {
      teamId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: payload.status,
      avatar: payload.avatar,
    },
  });

  log.info("createTeamMember: member created", {
    teamId,
    memberId: member.id,
  });
  return rowToTeamMember(member);
}

export async function updateTeamMember(
  teamId: number,
  memberId: number,
  payload: UpdateTeamMemberPayload,
): Promise<TeamMember | null> {
  log.debug("updateTeamMember: updating member", { teamId, memberId, payload });

  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: { id: true },
  });
  if (!existing) {
    log.warn("updateTeamMember: member not found", { teamId, memberId });
    return null;
  }

  const data: Prisma.TeamMemberUpdateInput = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.email !== undefined) data.email = payload.email;
  if (payload.role !== undefined) data.role = payload.role;
  if (payload.status !== undefined) data.status = payload.status;
  if (payload.avatar !== undefined) data.avatar = payload.avatar;

  const member = await prisma.teamMember.update({
    where: { id: memberId },
    data,
  });

  log.debug("updateTeamMember: member updated", { teamId, memberId });
  return rowToTeamMember(member);
}

export async function deleteTeamMember(
  teamId: number,
  memberId: number,
): Promise<boolean> {
  log.info("deleteTeamMember: deleting member", { teamId, memberId });

  const existing = await prisma.teamMember.findFirst({
    where: { id: memberId, teamId },
    select: { id: true },
  });
  if (!existing) {
    log.warn("deleteTeamMember: member not found", { teamId, memberId });
    return false;
  }

  await prisma.teamMember.delete({
    where: { id: memberId },
  });

  log.info("deleteTeamMember: member deleted", { teamId, memberId });
  return true;
}
