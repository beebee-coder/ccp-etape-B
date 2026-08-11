import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
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

const MAX_LIMIT = 200;

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

function buildItem(
  row: Prisma.MediaItemGetPayload<object>,
  includeDataUrl: boolean,
): MediaItem | MediaItemMeta {
  const base: MediaItemMeta = {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    tags: row.tags,
    kind: row.kind as "image" | "video",
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : row.createdAt.toISOString(),
  };

  if (includeDataUrl) {
    return {
      ...base,
      dataUrl: row.dataUrl,
      thumbnailDataUrl: row.thumbnailUrl || undefined,
    } as MediaItem;
  }
  return base;
}

export async function getAll(opts: GetAllOptions = {}): Promise<MediaItem[]> {
  const { limit, offset, includeDataUrl = true } = opts;
  const safeLimit = limit ? Math.min(limit, MAX_LIMIT) : undefined;

  log.debug("getAll: fetching media items from database", {
    limit: safeLimit,
    offset,
    includeDataUrl,
  });

  try {
    const items = await prisma.mediaItem.findMany({
      skip: offset,
      take: safeLimit,
      orderBy: { createdAt: "desc" },
    });

    log.debug("getAll: media items retrieved", {
      count: items.length,
    });
    return items.map((item) => buildItem(item, includeDataUrl)) as MediaItem[];
  } catch (error) {
    log.error("getAll: error fetching media items", { error });
    throw error;
  }
}

export async function getById(id: string): Promise<MediaItem | undefined> {
  log.debug("getById: fetching media item by id", { id });
  try {
    const item = await prisma.mediaItem.findUnique({
      where: { id },
    });

    if (!item) {
      log.warn("getById: media item not found", { id });
      return undefined;
    }

    log.debug("getById: media item retrieved", { id, title: item.title });
    return buildItem(item, true) as MediaItem;
  } catch (error) {
    log.error("getById: error fetching media item", { error, id });
    throw error;
  }
}

export async function create(
  item: Omit<MediaItem, "id" | "createdAt" | "updatedAt">,
): Promise<MediaItem> {
  const id = generateId();

  log.debug("create: inserting new media item", {
    id,
    title: item.title,
    kind: item.kind,
    category: item.category,
    size: item.size,
  });

  try {
    const created = await prisma.mediaItem.create({
      data: {
        id,
        title: item.title,
        category: item.category,
        description: item.description,
        tags: item.tags,
        kind: item.kind,
        mimeType: item.mimeType,
        size: item.size,
        dataUrl: item.dataUrl,
        thumbnailUrl: item.thumbnailDataUrl || null,
        locationType: item.location?.locationType || null,
        locationPath: item.location?.locationPath || null,
        blocCode: item.location?.blocCode || null,
        equipementCode: item.location?.equipementCode || null,
      },
    });

    log.debug("create: media item inserted", {
      id: created.id,
      title: created.title,
      kind: created.kind,
    });

    return buildItem(created, true) as MediaItem;
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
  log.debug("update: updating media item", {
    id,
    fields: Object.keys(updates),
  });

  const data: Prisma.MediaItemUpdateInput = {};
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.category !== undefined) data.category = updates.category;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.tags !== undefined) data.tags = updates.tags;
  if (updates.kind !== undefined) data.kind = updates.kind;
  if (updates.mimeType !== undefined) data.mimeType = updates.mimeType;
  if (updates.size !== undefined) data.size = updates.size;
  if (updates.dataUrl !== undefined) data.dataUrl = updates.dataUrl;
  if (updates.thumbnailDataUrl !== undefined) data.thumbnailUrl = updates.thumbnailDataUrl;
  if (updates.location !== undefined) {
    data.locationType = updates.location.locationType;
    data.locationPath = updates.location.locationPath || null;
    data.blocCode = updates.location.blocCode || null;
    data.equipementCode = updates.location.equipementCode || null;
  }

  try {
    const updated = await prisma.mediaItem.update({
      where: { id },
      data,
    });

    log.debug("update: media item updated", { id: updated.id, title: updated.title });

    return buildItem(updated, true) as MediaItem;
  } catch (error) {
    log.error("update: error updating media item", { error, id });
    throw error;
  }
}

export async function getCategories(): Promise<string[]> {
  log.debug("getCategories: fetching distinct categories");

  try {
    const categories = await prisma.mediaItem.findMany({
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    const cats = categories.map((c) => c.category);
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
    await prisma.mediaItem.delete({
      where: { id },
    });

    log.debug("remove: media item deleted", { id });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      log.warn("remove: media item not found for deletion", { id });
      return false;
    }
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
    const count = await prisma.mediaItem.count();
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
    const result = await prisma.mediaItem.aggregate({
      _sum: { size: true },
    });
    const total = result._sum.size ?? 0;
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
    const [total, totalImages, totalVideos, totalSizeResult, categories] = await Promise.all([
      prisma.mediaItem.count(),
      prisma.mediaItem.count({ where: { kind: "image" } }),
      prisma.mediaItem.count({ where: { kind: "video" } }),
      prisma.mediaItem.aggregate({ _sum: { size: true } }),
      prisma.mediaItem.findMany({ select: { category: true }, distinct: ["category"] }),
    ]);

    log.debug("getStats: stats retrieved", { total, totalImages, totalVideos });
    return {
      total,
      totalSize: totalSizeResult._sum.size ?? 0,
      totalImages,
      totalVideos,
      categories: categories.map((c) => c.category),
    };
  } catch (error) {
    log.error("getStats: error fetching stats", { error });
    throw error;
  }
}
