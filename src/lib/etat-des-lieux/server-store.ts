import { query } from "@/lib/db";
import { z } from "zod";

export const MediaAttachmentSchema = z.object({
  kind: z.enum(["image", "video"]),
  dataUrl: z.string(),
  mimeType: z.string(),
  size: z.number().positive(),
  thumbnailDataUrl: z.string().optional(),
});

export const EtatDesLieuxReportSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  location: z.string().min(1, "Le lieu est requis"),
  attachments: z.array(MediaAttachmentSchema),
  status: z.enum(["draft", "sent"]),
  authorName: z.string().min(1, "Le nom de l'auteur est requis"),
  authorRole: z.string().min(1, "Le rôle de l'auteur est requis"),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const EtatDesLieuxReportInputSchema = EtatDesLieuxReportSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export interface MediaAttachment {
  kind: "image" | "video";
  dataUrl: string;
  mimeType: string;
  size: number;
  thumbnailDataUrl?: string;
}

export interface EtatDesLieuxReport {
  id: string;
  title: string;
  description: string;
  location: string;
  attachments: MediaAttachment[];
  status: "draft" | "sent";
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
}

export function generateId(): string {
  return `edl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAll(): Promise<EtatDesLieuxReport[]> {
  const result = await query<{
    id: string;
    title: string;
    description: string;
    location: string;
    attachments: MediaAttachment[];
    status: string;
    author_name: string;
    author_role: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, title, description, location, attachments, status, author_name, author_role, created_at, updated_at
     FROM etat_des_lieux_reports
     ORDER BY created_at DESC`
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    attachments: row.attachments || [],
    status: row.status as "draft" | "sent",
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getById(id: string): Promise<EtatDesLieuxReport | undefined> {
  const result = await query<{
    id: string;
    title: string;
    description: string;
    location: string;
    attachments: MediaAttachment[];
    status: string;
    author_name: string;
    author_role: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, title, description, location, attachments, status, author_name, author_role, created_at, updated_at
     FROM etat_des_lieux_reports
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    attachments: row.attachments || [],
    status: row.status as "draft" | "sent",
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function create(
  report: Omit<EtatDesLieuxReport, "id" | "createdAt" | "updatedAt">
): Promise<EtatDesLieuxReport> {
  const id = generateId();
  const now = new Date().toISOString();

  const result = await query<{
    id: string;
    title: string;
    description: string;
    location: string;
    attachments: MediaAttachment[];
    status: string;
    author_name: string;
    author_role: string;
    created_at: string;
    updated_at: string;
  }>(
    `INSERT INTO etat_des_lieux_reports (id, title, description, location, attachments, status, author_name, author_role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, title, description, location, attachments, status, author_name, author_role, created_at, updated_at`,
    [id, report.title, report.description, report.location, JSON.stringify(report.attachments), report.status, report.authorName, report.authorRole, now, now]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    attachments: row.attachments || [],
    status: row.status as "draft" | "sent",
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function update(
  id: string,
  updates: Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>
): Promise<EtatDesLieuxReport | undefined> {
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    setClauses.push(`description = $${paramIndex++}`);
    values.push(updates.description);
  }
  if (updates.location !== undefined) {
    setClauses.push(`location = $${paramIndex++}`);
    values.push(updates.location);
  }
  if (updates.attachments !== undefined) {
    setClauses.push(`attachments = $${paramIndex++}`);
    values.push(JSON.stringify(updates.attachments));
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(updates.status);
  }
  if (updates.authorName !== undefined) {
    setClauses.push(`author_name = $${paramIndex++}`);
    values.push(updates.authorName);
  }
  if (updates.authorRole !== undefined) {
    setClauses.push(`author_role = $${paramIndex++}`);
    values.push(updates.authorRole);
  }

  setClauses.push(`updated_at = $${paramIndex++}`);
  values.push(now);
  values.push(id);

  const result = await query<{
    id: string;
    title: string;
    description: string;
    location: string;
    attachments: MediaAttachment[];
    status: string;
    author_name: string;
    author_role: string;
    created_at: string;
    updated_at: string;
  }>(
    `UPDATE etat_des_lieux_reports SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING id, title, description, location, attachments, status, author_name, author_role, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) return undefined;

  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    attachments: row.attachments || [],
    status: row.status as "draft" | "sent",
    authorName: row.author_name,
    authorRole: row.author_role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function remove(id: string): Promise<boolean> {
  const result = await query<{ id: string }>("DELETE FROM etat_des_lieux_reports WHERE id = $1 RETURNING id", [id]);
  return result.rows.length > 0;
}
