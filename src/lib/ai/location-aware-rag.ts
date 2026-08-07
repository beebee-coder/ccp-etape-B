import { query } from "@/lib/db";
import { vectorize } from "./embeddings";
import { getLocationFilterClause, type LocationRef } from "@/lib/location/parser";

export interface RagDocument {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export async function searchRagDocuments(
  message: string,
  limit = 5,
  collections?: string[],
): Promise<RagDocument[]> {
  const embedding = await vectorize(message);

  if (!embedding) {
    return [];
  }

  try {
    const collectionsToSearch = collections || ["qa", "procedures", "alarms", "media"];
    const placeholders = collectionsToSearch.map((_, i) => `$${i + 1}`).join(", ");

    const sql = `SELECT content, metadata_json,
                   1 - (embedding <=> $${collectionsToSearch.length + 1}::vector(384)) as similarity
             FROM chroma_index
             WHERE collection = ANY(ARRAY[${placeholders}]::text[])
               AND embedding IS NOT NULL
             ORDER BY embedding <=> $${collectionsToSearch.length + 1}::vector(384)
             LIMIT $${collectionsToSearch.length + 2}`;

    const params = [...collectionsToSearch, JSON.stringify(embedding), limit];

    const result = await query<{
      content: string;
      metadata_json: string;
      similarity: number;
    }>(sql, params);

    return result.rows.map((row) => ({
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      similarity: row.similarity,
    }));
  } catch {
    return [];
  }
}

export async function searchRagWithLocation(
  message: string,
  locations: LocationRef[],
  limit = 5,
  collections?: string[],
): Promise<RagDocument[]> {
  const embedding = await vectorize(message);

  if (!embedding) {
    return [];
  }

  try {
    const collectionsToSearch = collections || ["qa", "procedures", "alarms", "media"];
    const placeholders = collectionsToSearch.map((_, i) => `$${i + 1}`).join(", ");

    let whereClause = `WHERE collection = ANY(ARRAY[${placeholders}]::text[])
                        AND embedding IS NOT NULL`;

    if (locations.length > 0) {
      const locationFilters = locations
        .map((loc) => {
          const filterClause = getLocationFilterClause(loc, "metadata_json");
          if (!filterClause) return null;
          return `(${filterClause})`;
        })
        .filter(Boolean);

      if (locationFilters.length > 0) {
        whereClause += ` AND (${locationFilters.join(" OR ")})`;
      }
    }

    const paramOffset = collectionsToSearch.length + 1;
    const sql = `SELECT content, metadata_json,
                   1 - (embedding <=> $${paramOffset}::vector(384)) as similarity
             FROM chroma_index
             ${whereClause}
             ORDER BY embedding <=> $${paramOffset}::vector(384)
             LIMIT $${paramOffset + 1}`;

    const params = [...collectionsToSearch, JSON.stringify(embedding), limit];

    const result = await query<{
      content: string;
      metadata_json: string;
      similarity: number;
    }>(sql, params);

    return result.rows.map((row) => ({
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      similarity: row.similarity,
    }));
  } catch {
    return [];
  }
}

export async function searchAlarmsByCode(code: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await query(
      `SELECT * FROM alarms WHERE code = $1 LIMIT 1`,
      [code.toUpperCase()],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function searchByBloc(blocCode: string, limit = 10, collections?: string[]): Promise<RagDocument[]> {
  const collectionsToSearch = collections || ["qa", "procedures", "alarms", "media"];
  try {
    const placeholders = collectionsToSearch.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `SELECT content, metadata_json, 1 - (embedding <=> embedding) as similarity
             FROM chroma_index
             WHERE collection = ANY(ARRAY[${placeholders}]::text[])
               AND embedding IS NOT NULL
               AND (metadata_json->>'bloc_code' = $${collectionsToSearch.length + 1} OR metadata_json->>'location_path' LIKE $${collectionsToSearch.length + 2})
             LIMIT $${collectionsToSearch.length + 3}`;
    const params = [...collectionsToSearch, blocCode, `${blocCode}%`, limit];
    const result = await query<{ content: string; metadata_json: string; similarity: number }>(sql, params);
    return result.rows.map((row) => ({
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      similarity: row.similarity,
    }));
  } catch {
    return [];
  }
}
