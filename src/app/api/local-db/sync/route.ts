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

async function vectorizeText(text: string): Promise<number[]> {
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

function buildMetadata(data: Record<string, unknown>, entity: string): Record<string, unknown> {
  const meta: Record<string, unknown> = { type: entity, source: "sync" };
  if (data.title) meta.title = data.title;
  if (data.category) meta.category = data.category;
  if (data.tags && Array.isArray(data.tags)) meta.tags = data.tags;
  if (data.locationType) meta.location_type = data.locationType;
  if (data.locationPath) meta.location_path = data.locationPath;
  if (data.blocCode) meta.bloc_code = data.blocCode;
  if (data.equipementCode) meta.equipement_code = data.equipementCode;
  if (data.groupePath) meta.groupe_path = data.groupePath;
  if (data.alarmCode) meta.alarm_code = data.alarmCode;
  if (data.code) meta.code = data.code;
  if (data.location) meta.location = data.location;
  return meta;
}

async function upsertChromaIndex(
  collection: string,
  documentId: string,
  content: string,
  metadata: Record<string, unknown>,
  embedding: number[],
): Promise<void> {
  await query(
    `INSERT INTO chroma_index (collection, document_id, content, metadata_json, embedding)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(document_id) DO UPDATE SET
       content = EXCLUDED.content,
       metadata_json = EXCLUDED.metadata_json,
       embedding = EXCLUDED.embedding`,
    [collection, documentId, content, JSON.stringify(metadata), embedding],
  );
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

    const { operation, entity, entityId, data } = body;

    log.info("POST /api/local-db/sync: processing item", {
      operation,
      entity,
      entityId,
    });

    if (operation === "delete") {
      if (entity === "qa") {
        localDataSource.deleteKnowledgeItem(entityId);
        await query(`DELETE FROM knowledge_items WHERE id = $1 AND type = 'qa'`, [entityId]);
        await query(`DELETE FROM chroma_index WHERE document_id = $1 AND collection = 'qa'`, [entityId]);
      } else if (entity === "media") {
        await query(`DELETE FROM media_items WHERE id = $1`, [entityId]);
        await query(`DELETE FROM chroma_index WHERE document_id = $1 AND collection = 'media'`, [entityId]);
      } else if (entity === "alarm") {
        await query(`DELETE FROM alarms WHERE id = $1`, [entityId]);
        await query(`DELETE FROM chroma_index WHERE document_id = $1 AND collection = 'alarms'`, [entityId]);
      }
      log.debug("DELETE sync item processed", { entity, entityId });
      return NextResponse.json({ ok: true, entity, entityId, operation });
    }

    if (operation === "create" || operation === "update") {
      const itemData = data as Record<string, unknown>;

      if (entity === "qa") {
        const question = (itemData.question as string) ?? "";
        const answer = (itemData.answer as string) ?? "";
        const title = (itemData.title as string) ?? question.slice(0, 80);
        const tags = Array.isArray(itemData.tags)
          ? (itemData.tags as string[])
          : [];
        const category = (itemData.category as string) ?? null;

        const embedding = await vectorizeText(`Q: ${question}\nR: ${answer}`);

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

        await upsertChromaIndex(
          "qa",
          entityId,
          `Q: ${question}\nR: ${answer}`,
          buildMetadata({ ...itemData, type: "qa" }, "qa"),
          embedding,
        );

        log.debug("UPSERT sync item processed for qa", { entityId });
      } else if (entity === "media") {
        const metadata = buildMetadata(itemData, "media");
        const tagsArray = Array.isArray(itemData.tags) ? itemData.tags : [];
        const content = `${itemData.title} ${itemData.description || ""} ${tagsArray.join(" ")}`;
        const embedding = await vectorizeText(content);

        await query(
          `INSERT INTO media_items (id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, location_type, location_path, bloc_code, equipement_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT(id) DO UPDATE SET
             title = EXCLUDED.title,
             category = EXCLUDED.category,
             description = EXCLUDED.description,
             tags = EXCLUDED.tags,
             location_type = EXCLUDED.location_type,
             location_path = EXCLUDED.location_path,
             bloc_code = EXCLUDED.bloc_code,
             equipement_code = EXCLUDED.equipement_code,
             updated_at = EXCLUDED.updated_at`,
          [
            entityId,
            itemData.title,
            itemData.category,
            itemData.description || "",
            itemData.tags || [],
            itemData.kind,
            itemData.mimeType,
            itemData.size,
            itemData.dataUrl,
            itemData.thumbnailDataUrl || null,
            itemData.locationType || null,
            itemData.locationPath || null,
            itemData.blocCode || null,
            itemData.equipementCode || null,
            itemData.createdAt || new Date().toISOString(),
            itemData.updatedAt || new Date().toISOString(),
          ],
        );

        await upsertChromaIndex("media", entityId, content, metadata, embedding);
        log.debug("UPSERT sync item processed for media", { entityId });
      } else if (entity === "alarm") {
        const metadata = buildMetadata(itemData, "alarm");
        const content = `${itemData.code} ${itemData.description} ${itemData.condition || ""} ${JSON.stringify(itemData.remedy || {})}`;
        const embedding = await vectorizeText(content);

        await query(
          `INSERT INTO alarms (id, code, bloc_code, equipement_code, location_type, location_path, groupe_path, type, severity, description, condition, remedy, status, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT(code) DO UPDATE SET
             description = EXCLUDED.description,
             condition = EXCLUDED.condition,
             remedy = EXCLUDED.remedy,
             status = EXCLUDED.status,
             metadata = EXCLUDED.metadata,
             updated_at = EXCLUDED.updated_at`,
          [
            entityId,
            itemData.code,
            itemData.blocCode,
            itemData.equipementCode,
            itemData.locationType,
            itemData.locationPath,
            itemData.groupePath || null,
            itemData.type,
            itemData.severity,
            itemData.description,
            itemData.condition || null,
            itemData.remedy ? JSON.stringify(itemData.remedy) : null,
            itemData.status,
            JSON.stringify(metadata),
            itemData.createdAt || new Date().toISOString(),
            itemData.updatedAt || new Date().toISOString(),
          ],
        );

        await upsertChromaIndex("alarms", entityId, content, metadata, embedding);
        log.debug("UPSERT sync item processed for alarm", { entityId });
      } else if (entity === "procedure") {
        await query(
          `INSERT INTO procedures (id, code, title, description, category, priority, location_type, location_path, bloc_code, equipement_code, metadata_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT(code) DO UPDATE SET
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             location_type = EXCLUDED.location_type,
             location_path = EXCLUDED.location_path,
             bloc_code = EXCLUDED.bloc_code,
             equipement_code = EXCLUDED.equipement_code,
             updated_at = EXCLUDED.updated_at`,
          [
            entityId,
            itemData.code,
            itemData.title,
            itemData.description || "",
            itemData.category,
            itemData.priority || "moyenne",
            itemData.locationType || null,
            itemData.locationPath || null,
            itemData.blocCode || null,
            itemData.equipementCode || null,
            JSON.stringify(itemData.metadata || {}),
            itemData.createdAt || new Date().toISOString(),
            itemData.updatedAt || new Date().toISOString(),
          ],
        );
        log.debug("UPSERT sync item processed for procedure", { entityId });
      } else {
        log.debug("UPSERT sync item acknowledged for unknown entity", { entity, entityId });
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
