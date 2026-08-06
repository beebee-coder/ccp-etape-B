import fs from "fs";
import path from "path";
import { query, provider } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { SyncEngine } from "@/lib/local-db/sync-engine";
import type {
  QAItem,
  QAItemCreatePayload,
  QAItemUpdatePayload,
} from "./schemas";

const log = createLogger({ module: "q-r-server-store" });

interface KnowledgeItemRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  question: string;
  answer: string;
  tags: string | unknown[];
  category: string | null;
  createdAt: string;
  updatedAt: string | null;
  content: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

function deriveTitle(question: string): string {
  return question.length > 80 ? question.slice(0, 77) + "..." : question;
}

function rowToQA(row: KnowledgeItemRow): QAItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    title: row.title || deriveTitle(row.question),
    category: row.category || undefined,
    tags: parseTags(row.tags),
  };
}

function parseTags(tags: string | unknown[]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.filter((t: unknown) => typeof t === "string");
  }
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed)
      ? parsed.filter((t: unknown) => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getAllQAItems(): Promise<QAItem[]> {
  log.debug("getAllQAItems: fetching all Q/R items");
  const result = await query<KnowledgeItemRow>(
    `SELECT id, question, answer, title, category, tags
      FROM knowledge_items
      WHERE type = 'qa'
      ORDER BY "createdAt" DESC`,
  );

  log.debug("getAllQAItems: fetched items", { count: result.rows.length });
  return result.rows.map(rowToQA);
}

export async function getQAItemById(id: string): Promise<QAItem | null> {
  log.debug("getQAItemById: fetching item", { id });
  const result = await query<KnowledgeItemRow>(
    `SELECT id, question, answer, title, category, tags
      FROM knowledge_items
      WHERE id = $1 AND type = 'qa'`,
    [id],
  );

  if (result.rows.length === 0) {
    log.debug("getQAItemById: item not found", { id });
    return null;
  }
  log.debug("getQAItemById: item found", { id });
  return rowToQA(result.rows[0]);
}

export async function createQAItem(
  payload: QAItemCreatePayload,
  userId: string,
): Promise<QAItem> {
  log.debug("createQAItem: creating new Q/R item", {
    userId,
    question: payload.question,
  });
  const id = generateId();
  const now = new Date().toISOString();
  const title = payload.title || deriveTitle(payload.question);
  const tags = provider === "sqlite" ? JSON.stringify(payload.tags || []) : (payload.tags || []);

  const result = await query<KnowledgeItemRow>(
    `INSERT INTO knowledge_items (id, "userId", type, title, question, answer, tags, category, "createdAt", "updatedAt")
      VALUES ($1, $2, 'qa', $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, question, answer, title, category, tags`,
    [
      id,
      userId,
      title,
      payload.question,
      payload.answer,
      tags,
      payload.category || null,
      now,
      now,
    ],
  );

  log.debug("createQAItem: item created", { id, title });

  await SyncEngine.getInstance().enqueue("create", "qa", id, {
    id,
    userId,
    question: payload.question,
    answer: payload.answer,
    title,
    category: payload.category || null,
    tags: payload.tags || [],
  });

  return rowToQA(result.rows[0]);
}

export async function updateQAItem(
  id: string,
  payload: QAItemUpdatePayload,
  userId: string,
  isAdmin: boolean = false,
): Promise<QAItem | null> {
  log.debug("updateQAItem: updating item", { id, userId, payload, isAdmin });
  const now = new Date().toISOString();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (payload.question !== undefined) {
    setClauses.push(`question = $${paramIndex++}`);
    values.push(payload.question);
  }
  if (payload.answer !== undefined) {
    setClauses.push(`answer = $${paramIndex++}`);
    values.push(payload.answer);
  }
  if (payload.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(payload.title);
  }
  if (payload.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    values.push(payload.category);
  }
  if (payload.tags !== undefined) {
    setClauses.push(`tags = $${paramIndex++}`);
    values.push(provider === "sqlite" ? JSON.stringify(payload.tags) : payload.tags);
  }

  if (setClauses.length === 0) {
    log.debug("updateQAItem: no changes provided, returning current item", {
      id,
    });
    return getQAItemById(id);
  }

  setClauses.push(`"updatedAt" = $${paramIndex++}`);
  values.push(now);
  values.push(id);

  let whereClause: string;
  if (isAdmin) {
    whereClause = `WHERE id = $${paramIndex++} AND type = 'qa'`;
  } else {
    whereClause = `WHERE id = $${paramIndex++} AND "userId" = $${paramIndex++} AND type = 'qa'`;
    values.push(userId);
  }

  const result = await query<KnowledgeItemRow>(
    `UPDATE knowledge_items SET ${setClauses.join(", ")} ${whereClause}
      RETURNING id, question, answer, title, category, tags`,
    values,
  );

  if (result.rows.length === 0) {
    log.warn("updateQAItem: item not found or not authorized", { id, userId });
    return null;
  }
  log.debug("updateQAItem: item updated", { id });

  await SyncEngine.getInstance().enqueue("update", "qa", id, {
    id,
    userId,
    question: payload.question,
    answer: payload.answer,
    title: payload.title,
    category: payload.category,
    tags: payload.tags,
  });

  return rowToQA(result.rows[0]);
}

export async function deleteQAItem(
  id: string,
  userId: string,
  isAdmin: boolean = false,
): Promise<boolean> {
  log.debug("deleteQAItem: deleting item", { id, userId, isAdmin });

  let result: { rows: { id: string }[] };

  if (isAdmin) {
    result = await query<{ id: string }>(
      `DELETE FROM knowledge_items WHERE id = $1 AND type = 'qa' RETURNING id`,
      [id],
    );
  } else {
    result = await query<{ id: string }>(
      `DELETE FROM knowledge_items
        WHERE id = $1 AND "userId" = $2 AND type = 'qa'
        RETURNING id`,
      [id, userId],
    );
  }

  if (result.rows.length === 0) {
    log.warn("deleteQAItem: item not found or not authorized", { id, userId });
    return false;
  }
  log.debug("deleteQAItem: item deleted", { id });

  await SyncEngine.getInstance().enqueue("delete", "qa", id, {
    id,
    userId,
  });

  return true;
}

export async function getQAItemsForAI(): Promise<string> {
  log.debug("getQAItemsForAI: building FAQ context for AI");
  const items = await getAllQAItems();

  const registryPairs = await getRegistryQRPairs();

  if (items.length === 0 && registryPairs.length === 0) {
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

  if (registryPairs.length > 0) {
    lines.push("FICHIERS Q/R:");
    lines.push(
      ...registryPairs.map(
        (pair) => `- [${pair.source}] Q: ${pair.question}\n  R: ${pair.answer}`,
      ),
    );
  }

  const context = lines.join("\n");
  log.debug("getQAItemsForAI: context built", {
    dbItemCount: items.length,
    registryItemCount: registryPairs.length,
    contextLength: context.length,
  });
  return context;
}

async function getRegistryQRPairs(): Promise<Array<{ question: string; answer: string; source: string }>> {
  const pairs: Array<{ question: string; answer: string; source: string }> = [];
  const roots = [
    path.join(process.cwd(), ".registry", "items"),
    path.join(process.cwd(), ".local-db", "registry", "items"),
  ];

  for (const root of roots) {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      continue;
    }

    const entries = fs.readdirSync(root);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;

      const fullPath = path.join(root, entry);
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(raw);
        const source = entry.replace(/\.json$/i, "");

        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === "object" && typeof item.question === "string" && typeof item.answer === "string") {
              pairs.push({ question: item.question, answer: item.answer, source });
            }
          }
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.pairs)) {
          for (const item of parsed.pairs) {
            if (item && typeof item === "object" && typeof item.question === "string" && typeof item.answer === "string") {
              pairs.push({ question: item.question, answer: item.answer, source });
            }
          }
        }
      } catch {
        // ignore invalid registry files
      }
    }
  }

  return pairs;
}
