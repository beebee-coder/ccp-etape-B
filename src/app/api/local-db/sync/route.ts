import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { LocalDataSource } from "@/lib/local-db/data-source";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-sync" });
const localDataSource = LocalDataSource.getInstance();

const GOOGLE_AI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || "";
const EMBEDDING_DIMENSION = 384;

async function getGoogleEmbedding(text: string): Promise<number[] | null> {
  if (!GOOGLE_AI_API_KEY) return null;
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GOOGLE_AI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const values = result.embedding?.values ?? [];
    return values.slice(0, EMBEDDING_DIMENSION);
  } catch (error) {
    log.warn("Google embedding failed, falling back", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function vectorizeQAItem(
  question: string,
  answer: string,
): Promise<number[]> {
  const text = `Q: ${question}\nR: ${answer}`;
  const embedding = await getGoogleEmbedding(text);
  if (embedding && embedding.length > 0) return embedding;
  const hash = Buffer.from(text).toString("base64");
  const vec = new Array(EMBEDDING_DIMENSION).fill(0);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const idx = (i * 7 + 3) % hash.length;
    vec[i] = hash.charCodeAt(idx) / 255;
  }
  return vec;
}

async function purgeKnowledgeItemFromPG(id: string): Promise<void> {
  await query(`DELETE FROM knowledge_items WHERE id = $1 AND type = 'qa'`, [
    id,
  ]);
}

export async function POST(request: Request) {
  log.debug("POST /api/local-db/sync: received sync item");

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.entity || !body.entityId) {
      log.warn("POST /api/local-db/sync: invalid payload", { body });
      return NextResponse.json(
        { error: "Payload invalide: entity et entity_id requis" },
        { status: 400 },
      );
    }

    const { operation, entity, entityId, data, status } = body;

    log.info("POST /api/local-db/sync: processing item", {
      operation,
      entity,
      entityId,
      status,
    });

    if (entity === "qa") {
      if (operation === "delete") {
        localDataSource.deleteKnowledgeItem(entityId);
        await purgeKnowledgeItemFromPG(entityId);
        log.debug("DELETE sync item processed for qa", { entityId });
      } else if (operation === "create" || operation === "update") {
        const itemData = data as Record<string, unknown>;
        const question = (itemData.question as string) ?? "";
        const answer = (itemData.answer as string) ?? "";
        const title = (itemData.title as string) ?? question.slice(0, 80);
        const tags = Array.isArray(itemData.tags)
          ? (itemData.tags as string[])
          : [];
        const category = (itemData.category as string) ?? null;

        const embedding = await vectorizeQAItem(question, answer);

        try {
          localDataSource.upsertKnowledgeItem({
            id: entityId,
            user_id: "local",
            type: "qa",
            title,
            question,
            answer,
            tags,
            category,
            content: `Q: ${question}\nR: ${answer}`,
            synced: 1,
            vectorized: 1,
          });
        } catch (localError) {
          log.error("UPSERT local knowledge item failed", { entityId, error: localError });
          throw localError;
        }

        try {
          await query(
            `INSERT INTO chroma_index (collection, document_id, content, metadata_json, embedding)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT(document_id) DO UPDATE SET
               content = EXCLUDED.content,
               metadata_json = EXCLUDED.metadata_json,
               embedding = EXCLUDED.embedding`,
            [
              "qa",
              entityId,
              `Q: ${question}\nR: ${answer}`,
              JSON.stringify({ type: "qa", title, category, tags }),
              embedding,
            ],
          );
        } catch (pgError) {
          log.error("INSERT chroma_index failed", { entityId, error: pgError });
          throw pgError;
        }

        log.debug("UPSERT sync item processed for qa", { entityId });
      }
    } else {
      if (operation === "delete") {
        log.debug("DELETE sync item acknowledged", { entity, entityId });
      } else if (operation === "create" || operation === "update") {
        log.debug("UPSERT sync item acknowledged", { entity, entityId });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Sync item traité",
      entity,
      entityId,
      operation,
    });
  } catch (error) {
    log.error("POST /api/local-db/sync: error", { error });
    return NextResponse.json(
      { error: "Erreur lors du traitement du sync" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/local-db/sync",
    method: "POST",
  });
}
