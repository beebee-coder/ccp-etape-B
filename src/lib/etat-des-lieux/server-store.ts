import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "etat-des-lieux-server-store" });

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
  log.info("getAll: fetching all etat_des_lieux reports");

  try {
    const reports = await prisma.etatDesLieuxReport.findMany({
      orderBy: { createdAt: "desc" },
    });

    log.info("getAll: successfully fetched reports", { count: reports.length });
    return reports.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      attachments: (row.attachments as unknown as MediaAttachment[]) || [],
      status: row.status as "draft" | "sent",
      authorName: row.authorName,
      authorRole: row.authorRole,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt ? row.updatedAt.toISOString() : row.createdAt.toISOString(),
    }));
  } catch (error) {
    log.error("getAll: failed to fetch reports from database", { error });
    throw error;
  }
}

export async function getById(id: string): Promise<EtatDesLieuxReport | undefined> {
  log.info("getById: fetching report by id", { id });

  try {
    const report = await prisma.etatDesLieuxReport.findUnique({
      where: { id },
    });

    if (!report) {
      log.warn("getById: report not found", { id });
      return undefined;
    }

    log.info("getById: report found", { id, title: report.title });
    return {
      id: report.id,
      title: report.title,
      description: report.description,
      location: report.location,
      attachments: (report.attachments as unknown as MediaAttachment[]) || [],
      status: report.status as "draft" | "sent",
      authorName: report.authorName,
      authorRole: report.authorRole,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt ? report.updatedAt.toISOString() : report.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("getById: failed to fetch report", { id, error });
    throw error;
  }
}

export async function create(
  report: Omit<EtatDesLieuxReport, "id" | "createdAt" | "updatedAt">
): Promise<EtatDesLieuxReport> {
  const id = generateId();

  log.info("create: inserting new etat_des_lieux report", {
    id,
    title: report.title,
    location: report.location,
    status: report.status,
    attachmentCount: report.attachments.length,
  });

  try {
    const created = await prisma.etatDesLieuxReport.create({
      data: {
        id,
        title: report.title,
        description: report.description,
        location: report.location,
        attachments: report.attachments as unknown as Prisma.InputJsonValue,
        status: report.status,
        authorName: report.authorName,
        authorRole: report.authorRole,
      },
    });

    log.info("create: report successfully created", { id, title: created.title });
    return {
      id: created.id,
      title: created.title,
      description: created.description,
      location: created.location,
      attachments: (created.attachments as unknown as MediaAttachment[]) || [],
      status: created.status as "draft" | "sent",
      authorName: created.authorName,
      authorRole: created.authorRole,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt ? created.updatedAt.toISOString() : created.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("create: failed to insert report into database", { id, error });
    throw error;
  }
}

export async function update(
  id: string,
  updates: Partial<Omit<EtatDesLieuxReport, "id" | "createdAt">>
): Promise<EtatDesLieuxReport | undefined> {
  log.info("update: updating etat_des_lieux report", {
    id,
    fields: Object.keys(updates),
  });

  try {
    const data: Record<string, unknown> = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.location !== undefined) data.location = updates.location;
    if (updates.attachments !== undefined) data.attachments = updates.attachments as unknown as Prisma.InputJsonValue;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.authorName !== undefined) data.authorName = updates.authorName;
    if (updates.authorRole !== undefined) data.authorRole = updates.authorRole;

    const updated = await prisma.etatDesLieuxReport.update({
      where: { id },
      data,
    });

    log.info("update: report successfully updated", { id, title: updated.title });
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      location: updated.location,
      attachments: (updated.attachments as unknown as MediaAttachment[]) || [],
      status: updated.status as "draft" | "sent",
      authorName: updated.authorName,
      authorRole: updated.authorRole,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : updated.createdAt.toISOString(),
    };
  } catch (error) {
    log.error("update: failed to update report", { id, error });
    throw error;
  }
}

export async function remove(id: string): Promise<boolean> {
  log.info("remove: deleting etat_des_lieux report", { id });

  try {
    await prisma.etatDesLieuxReport.delete({
      where: { id },
    });

    log.info("remove: report successfully deleted", { id });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      log.warn("remove: report not found for deletion", { id });
      return false;
    }
    log.error("remove: failed to delete report", { id, error });
    throw error;
  }
}
