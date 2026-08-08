/**
 * POST /api/local-db/sync-all
 *
 * Endpoint utilisé par le bouton "Synchroniser vers local" de la page admin
 * lorsque l'app tourne dans un navigateur standard (URL Vercel, non-Tauri).
 *
 * Flux côté serveur :
 *   1. Lit toutes les tables depuis la BDD web (Neon/PgSQL)
 *   2. Retourne un payload JSON au client
 *   3. Déclenche la purge de la BDD web (migration définitive vers local)
 *
 * ⚠️  L'import SQLite se fait EXCLUSIVEMENT côté client (BrowserDb / SQLite-WASM + OPFS).
 *     Ce handler ne doit JAMAIS importer better-sqlite3 ou LocalDataSource.
 *
 * Pagination :
 *  - ?page=N&limit=M pour charger les tables volumineuses par paquets.
 *  - Par défaut, limite les médias et l'index chroma à 500 lignes par page.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-sync-all" });
const DEFAULT_LIMIT = 500;

function getPageLimit(searchParams: URLSearchParams): number {
  const limit = searchParams.get("limit");
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 2000) {
      return parsed;
    }
  }
  return DEFAULT_LIMIT;
}

function getPage(searchParams: URLSearchParams): number {
  const page = searchParams.get("page");
  if (page) {
    const parsed = parseInt(page, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 1;
}

function offset(page: number, limit: number): number {
  return (page - 1) * limit;
}

export async function POST(request: Request) {
  try {
    log.info("POST /api/local-db/sync-all: starting export");

    const { searchParams } = new URL(request.url);
    const limit = getPageLimit(searchParams);
    const page = getPage(searchParams);
    const off = offset(page, limit);

    // ── 1. Lecture des données depuis la BDD web ──────────────────────────
    const [
      procedures,
      procedureSteps,
      alarms,
      alarmEvents,
      mediaItems,
      knowledgeItems,
      locationNodes,
      dataAssignments,
      guardrailRules,
      chromaIndex,
    ] = await Promise.all([
      query("SELECT * FROM procedures ORDER BY created_at ASC"),
      query("SELECT * FROM procedure_steps ORDER BY procedure_id, step_order ASC"),
      query("SELECT * FROM alarms ORDER BY created_at ASC"),
      query("SELECT * FROM alarm_events ORDER BY occurred_at ASC"),
      query(`SELECT * FROM media_items ORDER BY created_at ASC LIMIT ${limit} OFFSET ${off}`),
      query("SELECT * FROM knowledge_items ORDER BY created_at ASC"),
      query("SELECT * FROM location_nodes ORDER BY created_at ASC"),
      query("SELECT * FROM data_assignments ORDER BY created_at ASC"),
      query("SELECT * FROM guardrail_rules ORDER BY created_at ASC"),
      query(
        `SELECT id, collection, document_id, content, metadata_json, embedding, created_at FROM chroma_index ORDER BY created_at ASC LIMIT ${limit} OFFSET ${off}`,
      ),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      page,
      limit,
      tables: {
        procedures:      procedures.rows      as Record<string, unknown>[],
        procedureSteps:  procedureSteps.rows  as Record<string, unknown>[],
        alarms:          alarms.rows          as Record<string, unknown>[],
        alarmEvents:     alarmEvents.rows     as Record<string, unknown>[],
        mediaItems:      mediaItems.rows      as Record<string, unknown>[],
        knowledgeItems:  knowledgeItems.rows  as Record<string, unknown>[],
        locationNodes:   locationNodes.rows   as Record<string, unknown>[],
        dataAssignments: dataAssignments.rows as Record<string, unknown>[],
        guardrailRules:  guardrailRules.rows  as Record<string, unknown>[],
        chromaIndex:     chromaIndex.rows     as Record<string, unknown>[],
      },
      counts: {
        procedures:      procedures.rowCount,
        procedureSteps:  procedureSteps.rowCount,
        alarms:          alarms.rowCount,
        alarmEvents:     alarmEvents.rowCount,
        mediaItems:      mediaItems.rowCount,
        knowledgeItems:  knowledgeItems.rowCount,
        locationNodes:   locationNodes.rowCount,
        dataAssignments: dataAssignments.rowCount,
        guardrailRules:  guardrailRules.rowCount,
        chromaIndex:     chromaIndex.rowCount,
      },
    };

    const totalRows = Object.values(payload.counts).reduce((a, b) => a + b, 0);
    log.info("POST /api/local-db/sync-all: export ready", {
      totalRows,
      page,
      limit,
      counts: payload.counts,
    });

    // ── 2. Purge de la BDD web (migration définitive vers local) ─────────
    //    Appelé après la construction du payload pour ne pas perdre les données.
    let purged = false;
    try {
      const origin =
        request.headers.get("origin") ??
        process.env.NEXT_PUBLIC_API_URL ??
        "";

      const controller = new AbortController();
      const purgeTimeout = setTimeout(() => controller.abort(), 8000);

      try {
        const purgeResponse = await fetch(`${origin}/api/local-db/purge`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        });

        clearTimeout(purgeTimeout);

        if (purgeResponse.ok) {
          const purgeResult = (await purgeResponse.json()) as { ok: boolean };
          purged = purgeResult.ok;
          log.info("POST /api/local-db/sync-all: web DB purged", { purged });
        } else {
          log.warn("POST /api/local-db/sync-all: purge non bloquante échouée", {
            status: purgeResponse.status,
          });
        }
      } catch (purgeError) {
        clearTimeout(purgeTimeout);
        if (purgeError instanceof Error && purgeError.name === "AbortError") {
          log.warn("POST /api/local-db/sync-all: purge timeout (non bloquant)");
        } else {
          throw purgeError;
        }
      }
    } catch (purgeError) {
      // La purge est non-bloquante : on retourne quand même le payload
      log.warn("POST /api/local-db/sync-all: erreur purge (non bloquante)", {
        error: purgeError,
      });
    }

    // ── 3. Retour du payload au client ────────────────────────────────────
    //    Le client (SyncLocalButton / BrowserDb) se charge d'insérer
    //    les données dans SQLite-WASM via l'API OPFS.
    const hasMore =
      (mediaItems.rowCount ?? 0) >= limit || (chromaIndex.rowCount ?? 0) >= limit;

    return NextResponse.json({
      ok: true,
      purged,
      totalRows,
      page,
      limit,
      hasMore,
      counts: payload.counts,
      payload,
    });
  } catch (error) {
    log.error("POST /api/local-db/sync-all: error", { error });
    return NextResponse.json(
      { error: "Erreur lors de l'export des données" },
      { status: 500 },
    );
  }
}
