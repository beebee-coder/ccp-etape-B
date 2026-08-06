import type {
  TeamInfo,
  TeamMember,
  CreateTeamPayload,
  CreateTeamMemberPayload,
  UpdateTeamPayload,
  UpdateTeamMemberPayload,
} from "@/lib/teams/schemas";
import { apiClient } from "@/lib/api/client";

const API_BASE = "/api/equipes";

export const teamsService = {
  async getAll(): Promise<TeamInfo[]> {
    return apiClient.get<TeamInfo[]>(API_BASE);
  },

  async getById(id: number): Promise<TeamInfo> {
    return apiClient.get<TeamInfo>(`${API_BASE}/${id}`);
  },

  async create(team: CreateTeamPayload): Promise<TeamInfo> {
    return apiClient.post<TeamInfo>(API_BASE, team);
  },

  async update(id: number, payload: UpdateTeamPayload): Promise<TeamInfo> {
    return apiClient.put<TeamInfo>(`${API_BASE}/${id}`, payload);
  },

  async delete(id: number): Promise<boolean> {
    await apiClient.delete(`${API_BASE}/${id}`);
    return true;
  },

  async getMembers(teamId: number): Promise<TeamMember[]> {
    return apiClient.get<TeamMember[]>(`${API_BASE}/${teamId}/members`);
  },

  async getMember(teamId: number, memberId: number): Promise<TeamMember> {
    return apiClient.get<TeamMember>(
      `${API_BASE}/${teamId}/members/${memberId}`,
    );
  },

  async createMember(
    teamId: number,
    member: CreateTeamMemberPayload,
  ): Promise<TeamMember> {
    return apiClient.post<TeamMember>(`${API_BASE}/${teamId}/members`, member);
  },

  async updateMember(
    teamId: number,
    memberId: number,
    payload: UpdateTeamMemberPayload,
  ): Promise<TeamMember> {
    return apiClient.put<TeamMember>(
      `${API_BASE}/${teamId}/members/${memberId}`,
      payload,
    );
  },

  async deleteMember(teamId: number, memberId: number): Promise<boolean> {
    await apiClient.delete(`${API_BASE}/${teamId}/members/${memberId}`);
    return true;
  },
};
