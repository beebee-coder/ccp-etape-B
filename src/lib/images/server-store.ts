import { query } from "@/lib/db";
import { z } from "zod";

export const MediaItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Le titre est requis"),
  category: z.string().min(1, "La catégorie est requise"),
  description: z.string().default(""),
  tags: z.array(z.string()),
  kind: z.enum(["image", "video"]),
  mimeType: z.string(),
  size: z.number().positive(),
  dataUrl: z.string(),
  thumbnailDataUrl: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const MediaItemInputSchema = MediaItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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
  createdAt: string;
  updatedAt: string;
}

export function generateId(): string {
  return `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<MediaItem[]> {
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
     ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags || [],
    kind: row.kind as "image" | "video",
    mimeType: row.mime_type,
    size: row.size,
    dataUrl: row.data_url,
    thumbnailDataUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getById(id: string): Promise<MediaItem | undefined> {
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
    [id]
  );

  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags || [],
    kind: row.kind as "image" | "video",
    mimeType: row.mime_type,
    size: row.size,
    dataUrl: row.data_url,
    thumbnailDataUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function create(item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">): Promise<MediaItem> {
  const id = generateId();
  const now = new Date().toISOString();

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
    `INSERT INTO media_items (id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, created_at, updated_at`,
    [id, item.title, item.category, item.description, item.tags, item.kind, item.mimeType, item.size, item.dataUrl, item.thumbnailDataUrl || null, now, now]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags || [],
    kind: row.kind as "image" | "video",
    mimeType: row.mime_type,
    size: row.size,
    dataUrl: row.data_url,
    thumbnailDataUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function update(
  id: string,
  updates: Partial<Omit<MediaItem, "id" | "createdAt">>
): Promise<MediaItem | undefined> {
  const now = new Date().toISOString();

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
    values
  );

  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags || [],
    kind: row.kind as "image" | "video",
    mimeType: row.mime_type,
    size: row.size,
    dataUrl: row.data_url,
    thumbnailDataUrl: row.thumbnail_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCategories(): Promise<string[]> {
  const result = await query<{ category: string }>(
    `SELECT DISTINCT category FROM media_items WHERE category IS NOT NULL ORDER BY category ASC`
  );

  const cats = result.rows.map((row) => row.category);
  return ["Tous", ...cats];
}

export async function remove(id: string): Promise<boolean> {
  const result = await query<{ id: string }>("DELETE FROM media_items WHERE id = $1 RETURNING id", [id]);
  return result.rows.length > 0;
}
