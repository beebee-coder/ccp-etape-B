import { query } from "@/lib/db";
import { vectorize } from "./embeddings";

export interface RagDocument {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export async function searchRagDocuments(
  message: string,
  limit = 5,
): Promise<RagDocument[]> {
  const embedding = await vectorize(message);

  if (!embedding) {
    return [];
  }

  try {
    const result = await query<{
      content: string;
      metadata_json: string;
      similarity: number;
    }>(
      `SELECT content, metadata_json,
              1 - (embedding <=> $1::vector(384)) as similarity
       FROM chroma_index
       WHERE collection = 'qa'
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector(384)
       LIMIT $2`,
      [JSON.stringify(embedding), limit],
    );

    return result.rows.map((row) => ({
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      similarity: row.similarity,
    }));
  } catch {
    return [];
  }
}
