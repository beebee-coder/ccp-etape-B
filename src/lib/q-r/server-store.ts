import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createLogger } from "@/lib/logger";
import type {
  QAItem,
  QAItemCreatePayload,
  QAItemUpdatePayload,
} from "./schemas";

const log = createLogger({ module: "q-r-server-store" });

function generateId(): string {
  return crypto.randomUUID();
}

function deriveTitle(question: string): string {
  return question.length > 80 ? question.slice(0, 77) + "..." : question;
}

function rowToQA(row: {
  id: string;
  userId: string;
  type: string;
  title: string;
  question: string | null;
  answer: string | null;
  tags: string[];
  category: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  content: string | null;
  locationType: string | null;
  locationPath: string | null;
  blocCode: string | null;
  equipementCode: string | null;
  groupePath: string | null;
  alarmCode: string | null;
  vueCode: string | null;
}): QAItem {
  return {
    id: row.id,
    question: row.question ?? "",
    answer: row.answer ?? "",
    title: row.title || deriveTitle(row.question ?? ""),
    category: row.category || undefined,
    tags: row.tags,
    location: row.locationType
      ? {
          locationType: row.locationType as "centrale" | "groupe" | "global",
          locationPath: row.locationPath || undefined,
          blocCode: row.blocCode || undefined,
          equipementCode: row.equipementCode || undefined,
          groupePath: row.groupePath || undefined,
          alarmCode: row.alarmCode || undefined,
          vueCode: row.vueCode || undefined,
        }
      : undefined,
  };
}

export async function getAllQAItems(options?: { limit?: number; offset?: number }): Promise<QAItem[]> {
  log.debug("getAllQAItems: fetching all Q/R items", options);
  const items = await prisma.knowledgeItem.findMany({
    where: { type: "qa" },
    orderBy: { createdAt: "desc" },
    take: options?.limit,
    skip: options?.offset,
  });

  log.debug("getAllQAItems: fetched items", { count: items.length });
  return items.map(rowToQA);
}

export async function getQAItemsForUser(userId: string): Promise<QAItem[]> {
  log.debug("getQAItemsForUser: fetching Q/R items for user", { userId });
  const items = await prisma.knowledgeItem.findMany({
    where: { type: "qa", userId },
    orderBy: { createdAt: "desc" },
  });

  log.debug("getQAItemsForUser: fetched items", { count: items.length, userId });
  return items.map(rowToQA);
}

export async function getQAItemById(id: string): Promise<QAItem | null> {
  log.debug("getQAItemById: fetching item", { id });
  const item = await prisma.knowledgeItem.findFirst({
    where: { id, type: "qa" },
  });

  if (!item) {
    log.debug("getQAItemById: item not found", { id });
    return null;
  }
  log.debug("getQAItemById: item found", { id });
  return rowToQA(item);
}

export async function createQAItem(
  payload: QAItemCreatePayload,
  userId: string,
): Promise<QAItem> {
  log.debug("createQAItem: creating new Q/R item", {
    userId,
    question: payload.question,
  });

  const title = payload.title || deriveTitle(payload.question);
  const location = payload.location;
  const locationType = location?.locationType || null;
  const locationPath = location?.locationPath || null;
  const blocCode = location?.blocCode || null;
  const equipementCode = location?.equipementCode || null;
  const groupePath = location?.groupePath || null;
  const alarmCode = location?.alarmCode || null;
  const vueCode = location?.vueCode || null;

  const item = await prisma.knowledgeItem.create({
    data: {
      id: generateId(),
      userId,
      type: "qa",
      title,
      question: payload.question,
      answer: payload.answer,
      tags: payload.tags || [],
      category: payload.category || null,
      locationType,
      locationPath,
      blocCode,
      equipementCode,
      groupePath,
      alarmCode,
      vueCode,
    },
  });

  log.debug("createQAItem: item created", { id: item.id, title });
  return rowToQA(item);
}

export async function updateQAItem(
  id: string,
  payload: QAItemUpdatePayload,
  userId: string,
  isAdmin: boolean = false,
): Promise<QAItem | null> {
  log.debug("updateQAItem: updating item", { id, userId, payload, isAdmin });

  const where: Prisma.KnowledgeItemWhereInput = {
    id,
    type: "qa",
  };
  if (!isAdmin) {
    where.userId = userId;
  }

  const data: Prisma.KnowledgeItemUpdateInput = {};
  if (payload.question !== undefined) data.question = payload.question;
  if (payload.answer !== undefined) data.answer = payload.answer;
  if (payload.title !== undefined) data.title = payload.title;
  if (payload.category !== undefined) data.category = payload.category;
  if (payload.tags !== undefined) data.tags = payload.tags;
  if (payload.location !== undefined) {
    data.locationType = payload.location.locationType || null;
    data.locationPath = payload.location.locationPath || null;
    data.blocCode = payload.location.blocCode || null;
    data.equipementCode = payload.location.equipementCode || null;
    data.groupePath = payload.location.groupePath || null;
    data.alarmCode = payload.location.alarmCode || null;
    data.vueCode = payload.location.vueCode || null;
  }

  const result = await prisma.knowledgeItem.updateMany({
    where,
    data,
  });

  if (result.count === 0) {
    log.warn("updateQAItem: item not found or not authorized", { id, userId });
    return null;
  }

  log.debug("updateQAItem: item updated", { id });
  const updated = await prisma.knowledgeItem.findFirst({
    where: { id, type: "qa" },
  });
  return updated ? rowToQA(updated) : null;
}

export async function deleteQAItem(
  id: string,
  userId: string,
  isAdmin: boolean = false,
): Promise<boolean> {
  log.debug("deleteQAItem: deleting item", { id, userId, isAdmin });

  const where: Prisma.KnowledgeItemWhereInput = {
    id,
    type: "qa",
  };
  if (!isAdmin) {
    where.userId = userId;
  }

  const result = await prisma.knowledgeItem.deleteMany({
    where,
  });

  if (result.count === 0) {
    log.warn("deleteQAItem: item not found or not authorized", { id, userId });
    return false;
  }

  log.debug("deleteQAItem: item deleted", { id });
  return true;
}

export async function createQAItemsBatch(
  items: Array<{ question: string; answer: string }>,
  userId: string,
): Promise<QAItem[]> {
  log.debug("createQAItemsBatch: creating batch of Q/R items", {
    userId,
    count: items.length,
  });

  return prisma.$transaction(
    async (tx) => {
      const created: QAItem[] = [];
      for (const item of items) {
        const title = deriveTitle(item.question);
        const createdItem = await tx.knowledgeItem.create({
          data: {
            id: generateId(),
            userId,
            type: "qa",
            title,
            question: item.question,
            answer: item.answer,
            tags: [],
            category: null,
            locationType: null,
            locationPath: null,
            blocCode: null,
            equipementCode: null,
            groupePath: null,
            alarmCode: null,
            vueCode: null,
          },
        });
        created.push(rowToQA(createdItem));
      }
      return created;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
}

export async function getQAItemsForAI(
  options?: {
    limit?: number;
    searchQuery?: string;
  },
): Promise<string> {
  log.debug("getQAItemsForAI: building FAQ context for AI", options);
  const limit = options?.limit ?? 50;
  const searchQuery = options?.searchQuery?.trim().toLowerCase();

  const where: Prisma.KnowledgeItemWhereInput = { type: "qa" };
  if (searchQuery) {
    where.OR = [
      { question: { contains: searchQuery, mode: "insensitive" } },
      { answer: { contains: searchQuery, mode: "insensitive" } },
    ];
  }

  const items = await prisma.knowledgeItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  if (items.length === 0) {
    log.debug("getQAItemsForAI: no items found, returning empty context");
    return "";
  }

  const lines: string[] = [];

  if (items.length > 0) {
    lines.push("FAQ CONNAISSANCE:");
    lines.push(
      ...items.map(
        (item) => `- Q: ${item.question}\n  R: ${item.answer}`,
      ),
    );
  }

  const context = lines.join("\n");
  log.debug("getQAItemsForAI: context built", {
    dbItemCount: items.length,
    contextLength: context.length,
  });
  return context;
}
