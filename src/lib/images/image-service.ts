export type MediaKind = "image" | "video";

export type { MediaItem } from "./server-store";
import type { MediaItem } from "./server-store";
import { apiClient } from "@/lib/api/client";

const API_BASE = "/api/images";

export const imageService = {
  async init(): Promise<void> {
    try {
      await apiClient.get(`${API_BASE}/health`);
    } catch {
      // health check is optional
    }
  },

  async getAll(): Promise<MediaItem[]> {
    return apiClient.get<MediaItem[]>(API_BASE);
  },

  async getById(id: string): Promise<MediaItem | undefined> {
    const item = await apiClient.get<MediaItem>(`${API_BASE}/${id}`);
    return item;
  },

  async create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
    return apiClient.post<MediaItem>(API_BASE, item);
  },

  async update(id: string, updates: Partial<Omit<MediaItem, "id" | "createdAt">>): Promise<MediaItem | undefined> {
    const item = await apiClient.put<MediaItem>(`${API_BASE}/${id}`, updates);
    return item;
  },

  async delete(id: string): Promise<boolean> {
    await apiClient.delete(`${API_BASE}/${id}`);
    return true;
  },

  async getCategories(): Promise<string[]> {
    const items = await this.getAll();
    return Array.from(new Set(items.map((item) => item.category)));
  },

  async getCount(): Promise<number> {
    const items = await this.getAll();
    return items.length;
  },

  async getTotalSize(): Promise<string> {
    const items = await this.getAll();
    const bytes = items.reduce((acc, item) => acc + item.size, 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};