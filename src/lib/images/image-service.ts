export type MediaKind = "image" | "video";

export type { MediaItem } from "./server-store";
export type { MediaItemMeta } from "./server-store";
export type { ImageStats } from "./server-store";
import type { MediaItem, MediaItemMeta, ImageStats } from "./server-store";
import { apiClient, ApiError } from "@/lib/api/client";

const API_BASE = "/api/images";
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 500;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status >= 500;
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryableError(error)) {
        break;
      }
      const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

async function logAndThrow<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[images-service] ${operation}: error`, {
      error,
      ...context,
    });
    throw error;
  }
}

export const imageService = {
  async getAll(opts?: { page?: number; limit?: number }): Promise<MediaItem[]> {
    return logAndThrow("getAll", async () => {
      return withRetry(async () => {
        const params = new URLSearchParams();
        if (opts?.page) params.set("page", String(opts.page));
        if (opts?.limit) params.set("limit", String(opts.limit));
        const qs = params.toString();
        const url = qs ? `${API_BASE}?${qs}` : API_BASE;
        const items = await apiClient.get<MediaItem[]>(url);
        console.debug("[images-service] getAll: retrieved items", {
          count: items.length,
          page: opts?.page,
          limit: opts?.limit,
        });
        return items;
      });
    });
  },

  async getAllMeta(opts?: {
    page?: number;
    limit?: number;
  }): Promise<MediaItemMeta[]> {
    return logAndThrow("getAllMeta", async () => {
      return withRetry(async () => {
        const params = new URLSearchParams();
        if (opts?.page) params.set("page", String(opts.page));
        if (opts?.limit) params.set("limit", String(opts.limit));
        params.set("meta_only", "true");
        const qs = params.toString();
        const items = await apiClient.get<MediaItemMeta[]>(`${API_BASE}?${qs}`);
        console.debug("[images-service] getAllMeta: retrieved meta items", {
          count: items.length,
          page: opts?.page,
          limit: opts?.limit,
        });
        return items;
      });
    });
  },

  async getById(id: string): Promise<MediaItem | undefined> {
    return logAndThrow(
      "getById",
      async () => {
        return withRetry(async () => {
          const item = await apiClient.get<MediaItem>(`${API_BASE}/${id}`);
          console.debug("[images-service] getById: retrieved item", { id });
          return item;
        });
      },
      { id },
    );
  },

  async create(
    item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">,
  ): Promise<MediaItem> {
    return logAndThrow(
      "create",
      async () => {
        const created = await apiClient.post<MediaItem>(API_BASE, item);
        console.debug("[images-service] create: media item created", {
          id: created.id,
          title: created.title,
          kind: created.kind,
        });
        return created;
      },
      { title: item.title, kind: item.kind },
    );
  },

  async update(
    id: string,
    updates: Partial<Omit<MediaItem, "id" | "createdAt">>,
  ): Promise<MediaItem | undefined> {
    return logAndThrow(
      "update",
      async () => {
        const item = await apiClient.put<MediaItem>(
          `${API_BASE}/${id}`,
          updates,
        );
        console.debug("[images-service] update: media item updated", { id });
        return item;
      },
      { id },
    );
  },

  async delete(id: string): Promise<void> {
    return logAndThrow(
      "delete",
      async () => {
        await apiClient.delete(`${API_BASE}/${id}`);
        console.debug("[images-service] delete: media item deleted", { id });
      },
      { id },
    );
  },

  async getCategories(): Promise<string[]> {
    return logAndThrow("getCategories", async () => {
      const stats = await this.getStats();
      console.debug("[images-service] getCategories: retrieved from server", {
        count: stats.categories.length,
      });
      return stats.categories;
    });
  },

  async getCount(): Promise<number> {
    return logAndThrow("getCount", async () => {
      const stats = await this.getStats();
      console.debug("[images-service] getCount: count retrieved", {
        count: stats.total,
      });
      return stats.total;
    });
  },

  async getTotalSize(): Promise<string> {
    return logAndThrow("getTotalSize", async () => {
      const stats = await this.getStats();
      const formatted = formatSize(stats.totalSize);
      console.debug("[images-service] getTotalSize: total size retrieved", {
        bytes: stats.totalSize,
        formatted,
      });
      return formatted;
    });
  },

  async getStats(): Promise<ImageStats> {
    return logAndThrow("getStats", async () => {
      return withRetry(async () => {
        const stats = await apiClient.get<ImageStats>(`${API_BASE}/summary`);
        console.debug("[images-service] getStats: stats retrieved", {
          total: stats.total,
          totalSize: stats.totalSize,
          totalImages: stats.totalImages,
          totalVideos: stats.totalVideos,
        });
        return stats;
      });
    });
  },
};
