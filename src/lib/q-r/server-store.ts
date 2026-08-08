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
  locationType: string | null;
  locationPath: string | null;
  blocCode: string | null;
  equipementCode: string | null;
}

function generateId(): string {
  return crypto.randomUUID();
}

function deriveTitle(question: string): string {
  return question.length > 80 ? question.slice(0, 77) + "..." : question;
}

function buildLocalFilePath(location: { locationType: string; locationPath?: string; blocCode?: string; equipementCode?: string; groupePath?: string } | undefined): string {
  const root = path.join(process.cwd(), ".locale-db");
  if (!location || !location.locationPath) {
    return path.join(root, "registry", "items", `global-qa-${Date.now()}.json`);
  }

  if (location.locationType === "centrale" && location.blocCode && location.equipementCode) {
    return path.join(root, "Centrale", location.blocCode, location.equipementCode, "data", "qr", `qa-${Date.now()}.json`);
  }
  if (location.locationType === "groupe" && location.groupePath) {
    return path.join(root, "Groupes", location.groupePath, "data", "qr", `qa-${Date.now()}.json`);
  }
  return path.join(root, "registry", "items", `global-qa-${Date.now()}.json`);
}

function writeQAFile(filePath: string, question: string, answer: string, title: string, location: { locationType: string; locationPath?: string; blocCode?: string; equipementCode?: string; groupePath?: string } | undefined): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = {
    type: "qa",
    title,
    location: location
      ? {
          type: location.locationType,
          path: location.locationPath,
          bloc: location.blocCode,
          equipement: location.equipementCode,
        }
      : undefined,
    pairs: [{ question, answer }],
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function rowToQA(row: KnowledgeItemRow): QAItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    title: row.title || deriveTitle(row.question),
    category: row.category || undefined,
    tags: parseTags(row.tags),
    location: row.locationType
      ? {
          locationType: row.locationType as "centrale" | "groupe" | "global",
          locationPath: row.locationPath || undefined,
          blocCode: row.blocCode || undefined,
          equipementCode: row.equipementCode || undefined,
        }
      : undefined,
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
    `SELECT id, question, answer, title, category, tags, location_type, location_path, bloc_code, equipement_code
      FROM knowledge_items
      WHERE type = 'qa'
      ORDER BY created_at DESC`,
  );

  log.debug("getAllQAItems: fetched items", { count: result.rows.length });
  return result.rows.map(rowToQA);
}

export async function getQAItemById(id: string): Promise<QAItem | null> {
  log.debug("getQAItemById: fetching item", { id });
  const result = await query<KnowledgeItemRow>(
    `SELECT id, question, answer, title, category, tags, location_type, location_path, bloc_code, equipement_code
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
  const location = payload.location;
  const locationType = location?.locationType || null;
  const locationPath = location?.locationPath || null;
  const blocCode = location?.blocCode || null;
  const equipementCode = location?.equipementCode || null;

  const result = await query<KnowledgeItemRow>(
    `INSERT INTO knowledge_items (id, user_id, type, title, question, answer, tags, category, location_type, location_path, bloc_code, equipement_code, created_at, updated_at)
      VALUES ($1, $2, 'qa', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, question, answer, title, category, tags, location_type, location_path, bloc_code, equipement_code`,
    [
      id,
      userId,
      title,
      payload.question,
      payload.answer,
      tags,
      payload.category || null,
      locationType,
      locationPath,
      blocCode,
      equipementCode,
      now,
      now,
    ],
  );

  log.debug("createQAItem: item created", { id, title });

  const filePath = buildLocalFilePath(location);
  writeQAFile(filePath, payload.question, payload.answer, title, location);

  await SyncEngine.getInstance().enqueue("create", "qa", id, {
    id,
    userId,
    question: payload.question,
    answer: payload.answer,
    title,
    category: payload.category || null,
    tags: payload.tags || [],
    locationType,
    locationPath,
    blocCode,
    equipementCode,
    filePath,
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

  setClauses.push(`updated_at = $${paramIndex++}`);
  values.push(now);
  values.push(id);

  let whereClause: string;
  if (isAdmin) {
    whereClause = `WHERE id = $${paramIndex++} AND type = 'qa'`;
  } else {
    whereClause = `WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} AND type = 'qa'`;
    values.push(userId);
  }

  const result = await query<KnowledgeItemRow>(
    `UPDATE knowledge_items SET ${setClauses.join(", ")} ${whereClause}
      RETURNING id, question, answer, title, category, tags, location_type, location_path, bloc_code, equipement_code`,
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
    location: payload.location,
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
        WHERE id = $1 AND user_id = $2 AND type = 'qa'
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

export async function getQAItemsForAI(
  options?: {
    limit?: number;
    searchQuery?: string;
  },
): Promise<string> {
  log.debug("getQAItemsForAI: building FAQ context for AI", options);
  const items = await getAllQAItems();

  const registryPairs = await getRegistryQRPairs();

  if (items.length === 0 && registryPairs.length === 0) {
    log.debug("getQAItemsForAI: no items found, returning empty context");
    return "";
  }

  const limit = options?.limit ?? 50;
  const searchQuery = options?.searchQuery?.trim().toLowerCase();

  const filteredItems = searchQuery
    ? items.filter(
        (item) =>
          item.question.toLowerCase().includes(searchQuery) ||
          item.answer.toLowerCase().includes(searchQuery),
      )
    : items;

  const limitedItems = filteredItems.slice(0, limit);

  const limitedRegistry = searchQuery
    ? registryPairs
        .filter(
          (pair) =>
            pair.question.toLowerCase().includes(searchQuery) ||
            pair.answer.toLowerCase().includes(searchQuery),
        )
        .slice(0, limit)
    : registryPairs.slice(0, limit);

  const lines: string[] = [];

  if (limitedItems.length > 0) {
    lines.push("FAQ CONNAISSANCE:");
    lines.push(
      ...limitedItems.map(
        (item) => `- Q: ${item.question}\n  R: ${item.answer}`,
      ),
    );
  }

  if (limitedRegistry.length > 0) {
    lines.push("FICHIERS Q/R:");
    lines.push(
      ...limitedRegistry.map(
        (pair) => `- [${pair.source}] Q: ${pair.question}\n  R: ${pair.answer}`,
      ),
    );
  }

  const context = lines.join("\n");
  log.debug("getQAItemsForAI: context built", {
    dbItemCount: limitedItems.length,
    registryItemCount: limitedRegistry.length,
    contextLength: context.length,
  });
  return context;
}

async function getRegistryQRPairs(): Promise<Array<{ question: string; answer: string; source: string }>> {
  const pairs: Array<{ question: string; answer: string; source: string }> = [];
  const roots = [
    path.join(process.cwd(), ".registry", "items"),
    path.join(process.cwd(), ".locale-db", "registry", "items"),
  ];

  function walkDir(dir: string, relativePrefix = ""): void {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return;
    }

    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath, relativePrefix ? `${relativePrefix}/${entry}` : entry);
        continue;
      }

      if (!entry.endsWith(".json")) continue;

      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        const parsed = JSON.parse(raw);
        const source = relativePrefix ? `${relativePrefix}/${entry.replace(/\.json$/i, "")}` : entry.replace(/\.json$/i, "");

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

  for (const root of roots) {
    walkDir(root);
  }

  return pairs;
}
