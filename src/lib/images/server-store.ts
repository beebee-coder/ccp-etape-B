import { query } from "@/lib/db";
import { z } from "zod";
import { createLogger } from "@/lib/logger";
import { LocationRefSchema } from "@/lib/location/types";

const log = createLogger({ module: "images-server-store" });

export const MediaItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Le titre est requis"),
  category: z.string().min(1, "La catégorie est requise"),
  description: z.string().default(""),
  tags: z.array(z.string()),
  kind: z.enum(["image", "video"]),
  mimeType: z.string(),
  size: z.number().positive().max(100 * 1024 * 1024),
  dataUrl: z.string(),
  thumbnailDataUrl: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  location: LocationRefSchema.optional(),
});

export const MediaItemInputSchema = MediaItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const MediaItemUpdateSchema = MediaItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export interface MediaItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  kind: "image" | "video";
  mimeType: string;
  size: number;
  dataUrl: string;
  thumbnailDataUrl?: string;
  location?: {
    locationType: "centrale" | "groupe" | "global";
    locationPath?: string;
    blocCode?: string;
    equipementCode?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type MediaItemMeta = Omit<MediaItem, "dataUrl" | "thumbnailDataUrl">;

export interface GetAllOptions {
  limit?: number;
  offset?: number;
  includeDataUrl?: boolean;
}

export interface ImageStats {
  total: number;
  totalSize: number;
  totalImages: number;
  totalVideos: number;
  categories: string[];
}

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function buildColumns(includeDataUrl: boolean): string {
  return includeDataUrl
    ? "id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, created_at, updated_at"
    : "id, title, category, description, tags, kind, mime_type, size, created_at, updated_at";
}

function buildItem(
  row: Record<string, unknown>,
  includeDataUrl: boolean,
): MediaItem | MediaItemMeta {
  const base: MediaItemMeta = {
    id: row.id as string,
    title: row.title as string,
    category: row.category as string,
    description: row.description as string,
    tags: (row.tags as string[]) || [],
    kind: row.kind as "image" | "video",
    mimeType: row.mime_type as string,
    size: row.size as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };

  if (includeDataUrl) {
    return {
      ...base,
      dataUrl: row.data_url as string,
      thumbnailDataUrl: row.thumbnail_url
        ? (row.thumbnail_url as string)
        : undefined,
    } as MediaItem;
  }
  return base;
}

export async function getAll(opts: GetAllOptions = {}): Promise<MediaItem[]> {
  const { limit, offset, includeDataUrl = true } = opts;
  const columns = buildColumns(includeDataUrl);

  log.debug("getAll: fetching media items from database", {
    limit,
    offset,
    includeDataUrl,
  });

  try {
    let limitClause = "";
    let offsetClause = "";
    if (limit !== undefined) {
      limitClause = "LIMIT $1";
    }
    if (offset !== undefined) {
      offsetClause = limit !== undefined ? " OFFSET $2" : " OFFSET $1";
    }
    const sql = `SELECT ${columns}
        FROM media_items
        ORDER BY created_at DESC
        ${limitClause}${offsetClause}`;
    const params: unknown[] = [];
    if (limit !== undefined && offset !== undefined) {
      params.push(limit, offset);
    } else if (limit !== undefined) {
      params.push(limit);
    } else if (offset !== undefined) {
      params.push(offset);
    }

    const result = await query<{
      id: string;
      title: string;
      category: string;
      description: string;
      tags: string[];
      kind: string;
      mime_type: string;
      size: number;
      data_url?: string;
      thumbnail_url?: string | null;
      created_at: string;
      updated_at: string;
    }>(sql, params.length > 0 ? params : undefined);

    const items = result.rows.map((row) =>
      buildItem(row, includeDataUrl),
    );

    log.debug("getAll: media items retrieved", {
      count: items.length,
      rowCount: result.rowCount,
    });
    return items as MediaItem[];
  } catch (error) {
    log.error("getAll: error fetching media items", { error });
    throw error;
  }
}

export async function getById(id: string): Promise<MediaItem | undefined> {
  log.debug("getById: fetching media item by id", { id });
  try {
    const result = await query<{
      id: string;
      title: string;
      category: string;
      description: string;
      tags: string[];
      kind: string;
      mime_type: string;
      size: number;
      data_url: string;
      thumbnail_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, created_at, updated_at
        FROM media_items
        WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      log.warn("getById: media item not found", { id });
      return undefined;
    }

    const row = result.rows[0];
    log.debug("getById: media item retrieved", { id, title: row.title });
    return buildItem(row, true) as MediaItem;
  } catch (error) {
    log.error("getById: error fetching media item", { error, id });
    throw error;
  }
}

export async function create(
  item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">,
): Promise<MediaItem> {
  const id = generateId();
  const now = new Date().toISOString();

  log.debug("create: inserting new media item", {
    id,
    title: item.title,
    kind: item.kind,
    category: item.category,
    size: item.size,
  });

  try {
    const result = await query<{
      id: string;
      title: string;
      category: string;
      description: string;
      tags: string[];
      kind: string;
      mime_type: string;
      size: number;
      data_url: string;
      thumbnail_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `INSERT INTO media_items (id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, location_type, location_path, bloc_code, equipement_code, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, location_type, location_path, bloc_code, equipement_code, created_at, updated_at`,
      [
        id,
        item.title,
        item.category,
        item.description,
        item.tags,
        item.kind,
        item.mimeType,
        item.size,
        item.dataUrl,
        item.thumbnailDataUrl || null,
        item.location?.locationType || null,
        item.location?.locationPath || null,
        item.location?.blocCode || null,
        item.location?.equipementCode || null,
        now,
        now,
      ],
    );

    const row = result.rows[0];
    log.debug("create: media item inserted", {
      id: row.id,
      title: row.title,
      kind: row.kind,
    });

    return buildItem(row, true) as MediaItem;
  } catch (error) {
    log.error("create: error inserting media item", {
      error,
      id,
      title: item.title,
    });
    throw error;
  }
}

export async function update(
  id: string,
  updates: Partial<Omit<MediaItem, "id" | "createdAt">>,
): Promise<MediaItem | undefined> {
  const now = new Date().toISOString();

  log.debug("update: updating media item", {
    id,
    fields: Object.keys(updates),
  });

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    values.push(updates.category);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex++}`);
    values.push(updates.tags);
  }
  if (updates.kind !== undefined) {
    setClauses.push(`kind = $${paramIndex++}`);
    values.push(updates.kind);
  }
  if (updates.mimeType !== undefined) {
    setClauses.push(`mime_type = $${paramIndex++}`);
    values.push(updates.mimeType);
  }
  if (updates.size !== undefined) {
    setClauses.push(`size = $${paramIndex++}`);
    values.push(updates.size);
  }
  if (updates.dataUrl !== undefined) {
    setClauses.push(`data_url = $${paramIndex++}`);
    values.push(updates.dataUrl);
  }
  if (updates.thumbnailDataUrl !== undefined) {
    setClauses.push(`thumbnail_url = $${paramIndex++}`);
    values.push(updates.thumbnailDataUrl);
  }

  setClauses.push(`updated_at = $${paramIndex++}`);
  values.push(now);
  values.push(id);

  try {
    const result = await query<{
      id: string;
      title: string;
      category: string;
      description: string;
      tags: string[];
      kind: string;
      mime_type: string;
      size: number;
      data_url: string;
      thumbnail_url: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `UPDATE media_items SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, created_at, updated_at`,
      values,
    );

    if (result.rows.length === 0) {
      log.warn("update: media item not found for update", { id });
      return undefined;
    }

    const row = result.rows[0];
    log.debug("update: media item updated", { id: row.id, title: row.title });

    return buildItem(row, true) as MediaItem;
  } catch (error) {
    log.error("update: error updating media item", { error, id });
    throw error;
  }
}

export async function getCategories(): Promise<string[]> {
  log.debug("getCategories: fetching distinct categories");

  try {
    const result = await query<{ category: string }>(
      `SELECT DISTINCT category FROM media_items WHERE category IS NOT NULL ORDER BY category ASC`,
    );

    const cats = result.rows.map((row) => row.category);
    log.debug("getCategories: categories retrieved", {
      count: cats.length,
      categories: cats,
    });
    return ["Tous", ...cats];
  } catch (error) {
    log.error("getCategories: error fetching categories", { error });
    throw error;
  }
}

export async function remove(id: string): Promise<boolean> {
  log.debug("remove: deleting media item", { id });

  try {
    const result = await query<{ id: string }>(
      "DELETE FROM media_items WHERE id = $1 RETURNING id",
      [id],
    );

    if (result.rows.length === 0) {
      log.warn("remove: media item not found for deletion", { id });
      return false;
    }

    log.debug("remove: media item deleted", { id });
    return true;
  } catch (error) {
    log.error("remove: error deleting media item", { error, id });
    throw error;
  }
}

export async function getAllMeta(
  opts: Omit<GetAllOptions, "includeDataUrl"> = {},
): Promise<MediaItemMeta[]> {
  const items = await getAll({ ...opts, includeDataUrl: false });
  return items as MediaItemMeta[];
}

export async function getCount(): Promise<number> {
  log.debug("getCount: fetching total count");
  try {
    const result = await query<{ count: number }>(
      "SELECT COUNT(*) as count FROM media_items",
    );
    const count = Number(result.rows[0]?.count ?? 0);
    log.debug("getCount: count retrieved", { count });
    return count;
  } catch (error) {
    log.error("getCount: error fetching count", { error });
    throw error;
  }
}

export async function getTotalSize(): Promise<number> {
  log.debug("getTotalSize: fetching total size");
  try {
    const result = await query<{ total: number | null }>(
      "SELECT SUM(size) as total FROM media_items",
    );
    const total = Number(result.rows[0]?.total ?? 0);
    log.debug("getTotalSize: total size retrieved", { bytes: total });
    return total;
  } catch (error) {
    log.error("getTotalSize: error fetching total size", { error });
    throw error;
  }
}

export async function getStats(): Promise<ImageStats> {
  log.debug("getStats: fetching aggregate stats");
  try {
    const [countResult, sizeResult] = await Promise.all([
      query<{ total: number; total_images: number; total_videos: number }>(
        `SELECT COUNT(*) as total,
         SUM(CASE WHEN kind = 'image' THEN 1 ELSE 0 END) as total_images,
         SUM(CASE WHEN kind = 'video' THEN 1 ELSE 0 END) as total_videos
         FROM media_items`,
      ),
      query<{ total: number | null }>(
        "SELECT SUM(size) as total FROM media_items",
      ),
    ]);

    const row = countResult.rows[0];
    const stats: ImageStats = {
      total: Number(row?.total ?? 0),
      totalSize: Number(sizeResult.rows[0]?.total ?? 0),
      totalImages: Number(row?.total_images ?? 0),
      totalVideos: Number(row?.total_videos ?? 0),
      categories: [],
    };

    log.debug("getStats: stats retrieved", { ...stats });
    return stats;
  } catch (error) {
    log.error("getStats: error fetching stats", { error });
    throw error;
  }
}
