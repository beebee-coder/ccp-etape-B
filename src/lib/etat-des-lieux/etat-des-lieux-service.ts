import type { EtatDesLieuxReport } from "./server-store";
import { apiClient } from "@/lib/api/client";

const API_BASE = "/api/etat-des-lieux";

export const etatDesLieuxService = {
  async init(): Promise<void> {
    try {
      await apiClient.get(`${API_BASE}/health`);
    } catch {
      // health check is optional
    }
  },

  async getAll(): Promise<EtatDesLieuxReport[]> {
    return apiClient.get<EtatDesLieuxReport[]>(API_BASE);
  },

  async getById(id: string): Promise<EtatDesLieuxReport | undefined> {
    const report = await apiClient.get<EtatDesLieuxReport>(`${API_BASE}/${id}`);
    return report;
  },

  async create(report: Omit<EtatDesLieuxReport, "id" | "createdAt" | "updatedAt">): Promise<EtatDesLieuxReport> {
    return apiClient.post<EtatDesLieuxReport>(API_BASE, report);
  },

  async update(id: string, updates: Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>): Promise<EtatDesLieuxReport | undefined> {
    const report = await apiClient.put<EtatDesLieuxReport>(`${API_BASE}/${id}`, updates);
    return report;
  },

  async delete(id: string): Promise<boolean> {
    await apiClient.delete(`${API_BASE}/${id}`);
    return true;
  },
};
