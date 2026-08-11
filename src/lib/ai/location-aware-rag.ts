import { prisma } from "@/lib/db";
import { vectorize } from "./embeddings";
import { type LocationRef } from "@/lib/location/parser";

export interface RagDocument {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

function matchesLocation(metadata: Record<string, unknown>, loc: LocationRef): boolean {
  if (loc.blocCode && metadata.bloc_code !== loc.blocCode) return false;
  if (loc.equipementCode && metadata.equipement_code !== loc.equipementCode) return false;
  if (loc.groupePath && !String(metadata.groupe_path).startsWith(loc.groupePath)) return false;
  if (loc.locationPath && !String(metadata.location_path).startsWith(loc.locationPath)) return false;
  if (loc.alarmCode && metadata.alarm_code !== loc.alarmCode) return false;
  return true;
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

    const result = await prisma.$queryRaw<
      {
        content: string;
        metadata_json: string;
        similarity: number;
      }[]
    >`
      SELECT content, metadata_json,
        1 - (embedding <=> ${embedding}::vector(384)) as similarity
      FROM chroma_index
      WHERE collection = ANY(${collectionsToSearch}::text[])
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embedding}::vector(384)
      LIMIT ${limit}
    `;

    return result.map((row) => ({
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

    const result = await prisma.$queryRaw<
      {
        content: string;
        metadata_json: string;
        similarity: number;
      }[]
    >`
      SELECT content, metadata_json,
        1 - (embedding <=> ${embedding}::vector(384)) as similarity
      FROM chroma_index
      WHERE collection = ANY(${collectionsToSearch}::text[])
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embedding}::vector(384)
      LIMIT ${limit * 10}
    `;

    return result
      .map((row) => ({
        content: row.content,
        metadata: JSON.parse(row.metadata_json || "{}"),
        similarity: row.similarity,
      }))
      .filter((doc) => locations.some((loc) => matchesLocation(doc.metadata, loc)))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function searchAlarmsByCode(code: string): Promise<Record<string, unknown> | null> {
  try {
    const alarm = await prisma.alarm.findFirst({
      where: { code: code.toUpperCase() },
    });

    if (!alarm) return null;
    return alarm as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function searchByBloc(blocCode: string, limit = 10, collections?: string[]): Promise<RagDocument[]> {
  const collectionsToSearch = collections || ["qa", "procedures", "alarms", "media"];
  try {
    const result = await prisma.$queryRaw<{
      content: string;
      metadata_json: string;
      similarity: number;
    }[]>`
      SELECT content, metadata_json, 1 - (embedding <=> embedding) as similarity
      FROM chroma_index
      WHERE collection = ANY(${collectionsToSearch}::text[])
        AND embedding IS NOT NULL
        AND (metadata_json->>'bloc_code' = ${blocCode} OR metadata_json->>'location_path' LIKE ${`${blocCode}%`})
      LIMIT ${limit}
    `;

    return result.map((row) => ({
      content: row.content,
      metadata: JSON.parse(row.metadata_json || "{}"),
      similarity: row.similarity,
    }));
  } catch {
    return [];
  }
}
