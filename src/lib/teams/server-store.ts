import { query } from "@/lib/db";
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

interface TeamRow {
  id: number;
  name: string;
  description: string | null;
  color: string;
  member_count: number;
  created_at: string;
  updated_at: string | null;
}

interface TeamMemberRow {
  id: number;
  team_id: number;
  name: string;
  email: string | null;
  role: string;
  status: string;
  avatar: string;
  created_at: string;
  updated_at: string | null;
}

function rowToTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    email: row.email || undefined,
    role: row.role,
    status: row.status as TeamMemberStatus,
    avatar: row.avatar,
  };
}

function rowToTeam(row: TeamRow, members: TeamMember[]): TeamInfo {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    color: row.color,
    members: members.length,
    membersList: members,
  };
}

export async function getAllTeams(): Promise<TeamInfo[]> {
  log.debug("getAllTeams: fetching all teams with members");
  const teamResult = await query<TeamRow>(
    `SELECT id, name, description, color, 
            (SELECT COUNT(*) FROM team_members WHERE team_members.team_id = teams.id) as member_count,
            created_at, updated_at
     FROM teams
     ORDER BY name ASC`,
  );

  log.debug("getAllTeams: teams fetched", { count: teamResult.rows.length });

  const teams: TeamInfo[] = [];
  for (const teamRow of teamResult.rows) {
    const memberResult = await query<TeamMemberRow>(
      `SELECT id, team_id, name, email, role, status, avatar, created_at, updated_at
       FROM team_members
       WHERE team_id = $1
       ORDER BY name ASC`,
      [teamRow.id],
    );
    const members = memberResult.rows.map(rowToTeamMember);
    teams.push(rowToTeam(teamRow, members));
  }

  log.debug("getAllTeams: building complete team objects", {
    teamCount: teams.length,
  });
  return teams;
}

export async function getTeamById(id: number): Promise<TeamInfo | null> {
  log.debug("getTeamById: fetching team", { id });
  const teamResult = await query<TeamRow>(
    `SELECT id, name, description, color,
            (SELECT COUNT(*) FROM team_members WHERE team_members.team_id = teams.id) as member_count,
            created_at, updated_at
     FROM teams
     WHERE id = $1`,
    [id],
  );

  if (teamResult.rows.length === 0) {
    log.debug("getTeamById: team not found", { id });
    return null;
  }

  const memberResult = await query<TeamMemberRow>(
    `SELECT id, team_id, name, email, role, status, avatar, created_at, updated_at
     FROM team_members
     WHERE team_id = $1
     ORDER BY name ASC`,
    [id],
  );

  const members = memberResult.rows.map(rowToTeamMember);
  const team = rowToTeam(teamResult.rows[0], members);
  log.debug("getTeamById: team found", { id, memberCount: members.length });
  return team;
}

export async function createTeam(
  payload: CreateTeamPayload,
): Promise<TeamInfo> {
  log.info("createTeam: creating new team", {
    name: payload.name,
    description: payload.description,
    memberCount: payload.members?.length ?? 0,
  });

  const now = new Date().toISOString();
  const teamResult = await query<TeamRow>(
    `INSERT INTO teams (name, description, color, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, color, created_at, updated_at`,
    [payload.name, payload.description, payload.color, now, now],
  );

  const teamId = teamResult.rows[0].id;
  log.debug("createTeam: team row created", { teamId });

  const members: TeamMember[] = [];
  if (payload.members && payload.members.length > 0) {
    for (const member of payload.members) {
      const memberResult = await query<TeamMemberRow>(
        `INSERT INTO team_members (team_id, name, email, role, status, avatar, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, team_id, name, email, role, status, avatar, created_at, updated_at`,
        [
          teamId,
          member.name,
          member.email || null,
          member.role,
          member.status,
          member.avatar,
          now,
          now,
        ],
      );
      members.push(rowToTeamMember(memberResult.rows[0]));
    }
    log.debug("createTeam: members added", {
      teamId,
      memberCount: members.length,
    });
  }

  const teamRow: TeamRow = {
    id: teamResult.rows[0].id,
    name: teamResult.rows[0].name,
    description: teamResult.rows[0].description,
    color: teamResult.rows[0].color,
    member_count: members.length,
    created_at: teamResult.rows[0].created_at,
    updated_at: teamResult.rows[0].updated_at,
  };
  const team = rowToTeam(teamRow, members);
  log.info("createTeam: team created successfully", {
    teamId,
    name: payload.name,
  });
  return team;
}

export async function updateTeam(
  id: number,
  payload: UpdateTeamPayload,
): Promise<TeamInfo | null> {
  log.debug("updateTeam: updating team", { id, payload });
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (payload.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(payload.name);
  }
  if (payload.description !== undefined) {
    setClauses.push(`description = $${idx++}`);
    values.push(payload.description);
  }
  if (payload.color !== undefined) {
    setClauses.push(`color = $${idx++}`);
    values.push(payload.color);
  }

  if (setClauses.length === 0) {
    log.debug("updateTeam: no fields to update, returning existing team", {
      id,
    });
    return getTeamById(id);
  }

  setClauses.push(`updated_at = $${idx++}`);
  values.push(now);
  values.push(id);

  const teamResult = await query<TeamRow>(
    `UPDATE teams SET ${setClauses.join(", ")} WHERE id = $${idx}
     RETURNING id, name, description, color, created_at, updated_at`,
    values,
  );

  if (teamResult.rows.length === 0) {
    log.warn("updateTeam: team not found", { id });
    return null;
  }

  const memberResult = await query<TeamMemberRow>(
    `SELECT id, team_id, name, email, role, status, avatar, created_at, updated_at
     FROM team_members WHERE team_id = $1 ORDER BY name ASC`,
    [id],
  );
  const members = memberResult.rows.map(rowToTeamMember);
  const teamRow: TeamRow = {
    id: teamResult.rows[0].id,
    name: teamResult.rows[0].name,
    description: teamResult.rows[0].description,
    color: teamResult.rows[0].color,
    member_count: members.length,
    created_at: teamResult.rows[0].created_at,
    updated_at: teamResult.rows[0].updated_at,
  };
  const team = rowToTeam(teamRow, members);
  log.debug("updateTeam: team updated", { id });
  return team;
}

export async function deleteTeam(id: number): Promise<boolean> {
  log.info("deleteTeam: deleting team", { id });
  const result = await query<{ id: number }>(
    `DELETE FROM teams WHERE id = $1 RETURNING id`,
    [id],
  );

  if (result.rows.length === 0) {
    log.warn("deleteTeam: team not found", { id });
    return false;
  }
  log.info("deleteTeam: team deleted", { id });
  return true;
}

export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  log.debug("getTeamMembers: fetching members", { teamId });
  const result = await query<TeamMemberRow>(
    `SELECT id, team_id, name, email, role, status, avatar, created_at, updated_at
     FROM team_members
     WHERE team_id = $1
     ORDER BY name ASC`,
    [teamId],
  );
  log.debug("getTeamMembers: members fetched", {
    teamId,
    count: result.rows.length,
  });
  return result.rows.map(rowToTeamMember);
}

export async function getTeamMemberById(
  teamId: number,
  memberId: number,
): Promise<TeamMember | null> {
  log.debug("getTeamMemberById: fetching member", { teamId, memberId });
  const result = await query<TeamMemberRow>(
    `SELECT id, team_id, name, email, role, status, avatar, created_at, updated_at
     FROM team_members
     WHERE id = $1 AND team_id = $2`,
    [memberId, teamId],
  );

  if (result.rows.length === 0) {
    log.debug("getTeamMemberById: member not found", { teamId, memberId });
    return null;
  }
  log.debug("getTeamMemberById: member found", { teamId, memberId });
  return rowToTeamMember(result.rows[0]);
}

export async function createTeamMember(
  teamId: number,
  payload: CreateTeamMemberPayload,
): Promise<TeamMember | null> {
  log.info("createTeamMember: creating member", { teamId, name: payload.name });

  const teamCheck = await query<{ id: number }>(
    `SELECT id FROM teams WHERE id = $1`,
    [teamId],
  );
  if (teamCheck.rows.length === 0) {
    log.warn("createTeamMember: team not found", { teamId });
    return null;
  }

  const now = new Date().toISOString();
  const result = await query<TeamMemberRow>(
    `INSERT INTO team_members (team_id, name, email, role, status, avatar, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, team_id, name, email, role, status, avatar, created_at, updated_at`,
    [
      teamId,
      payload.name,
      payload.email || null,
      payload.role,
      payload.status,
      payload.avatar,
      now,
      now,
    ],
  );

  log.info("createTeamMember: member created", {
    teamId,
    memberId: result.rows[0].id,
  });
  return rowToTeamMember(result.rows[0]);
}

export async function updateTeamMember(
  teamId: number,
  memberId: number,
  payload: UpdateTeamMemberPayload,
): Promise<TeamMember | null> {
  log.debug("updateTeamMember: updating member", { teamId, memberId, payload });
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (payload.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    values.push(payload.name);
  }
  if (payload.email !== undefined) {
    setClauses.push(`email = $${idx++}`);
    values.push(payload.email || null);
  }
  if (payload.role !== undefined) {
    setClauses.push(`role = $${idx++}`);
    values.push(payload.role);
  }
  if (payload.status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    values.push(payload.status);
  }
  if (payload.avatar !== undefined) {
    setClauses.push(`avatar = $${idx++}`);
    values.push(payload.avatar);
  }

  if (setClauses.length === 0) {
    log.debug(
      "updateTeamMember: no fields to update, returning existing member",
      { teamId, memberId },
    );
    return getTeamMemberById(teamId, memberId);
  }

  setClauses.push(`updated_at = $${idx++}`);
  values.push(now);
  values.push(memberId);
  values.push(teamId);

  const result = await query<TeamMemberRow>(
    `UPDATE team_members SET ${setClauses.join(", ")} WHERE id = $${idx} AND team_id = $${idx + 1}
     RETURNING id, team_id, name, email, role, status, avatar, created_at, updated_at`,
    values,
  );

  if (result.rows.length === 0) {
    log.warn("updateTeamMember: member not found", { teamId, memberId });
    return null;
  }
  log.debug("updateTeamMember: member updated", { teamId, memberId });
  return rowToTeamMember(result.rows[0]);
}

export async function deleteTeamMember(
  teamId: number,
  memberId: number,
): Promise<boolean> {
  log.info("deleteTeamMember: deleting member", { teamId, memberId });
  const result = await query<{ id: number }>(
    `DELETE FROM team_members WHERE id = $1 AND team_id = $2 RETURNING id`,
    [memberId, teamId],
  );

  if (result.rows.length === 0) {
    log.warn("deleteTeamMember: member not found", { teamId, memberId });
    return false;
  }
  log.info("deleteTeamMember: member deleted", { teamId, memberId });
  return true;
}
