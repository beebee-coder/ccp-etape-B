import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { PullEngine } from "@/lib/local-db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-sync-all" });

export async function POST() {
  try {
    log.info("POST /api/local-db/sync-all: starting sync");

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
      query("SELECT * FROM media_items ORDER BY created_at ASC"),
      query("SELECT * FROM knowledge_items ORDER BY created_at ASC"),
      query("SELECT * FROM location_nodes ORDER BY created_at ASC"),
      query("SELECT * FROM data_assignments ORDER BY created_at ASC"),
      query("SELECT * FROM guardrail_rules ORDER BY created_at ASC"),
      query("SELECT id, collection, document_id, content, metadata_json, embedding, created_at FROM chroma_index ORDER BY created_at ASC"),
    ]);

    const payload = {
      tables: {
        procedures: procedures.rows as Record<string, unknown>[],
        procedureSteps: procedureSteps.rows as Record<string, unknown>[],
        alarms: alarms.rows as Record<string, unknown>[],
        alarmEvents: alarmEvents.rows as Record<string, unknown>[],
        mediaItems: mediaItems.rows as Record<string, unknown>[],
        knowledgeItems: knowledgeItems.rows as Record<string, unknown>[],
        locationNodes: locationNodes.rows as Record<string, unknown>[],
        dataAssignments: dataAssignments.rows as Record<string, unknown>[],
        guardrailRules: guardrailRules.rows as Record<string, unknown>[],
        chromaIndex: chromaIndex.rows as Record<string, unknown>[],
      },
    };

    const engine = PullEngine.getInstance();
    const pullResult = engine.processPayload(payload);

    if (pullResult.failed > 0 && Object.keys(pullResult.pulled).length === 0) {
      log.error("POST /api/local-db/sync-all: pull failed completely", {
        errors: pullResult.errors,
      });
      return NextResponse.json(
        { error: "Échec de la synchronisation", details: pullResult.errors },
        { status: 500 },
      );
    }

    const purgeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/local-db/purge`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    let purged = false;
    if (purgeResponse.ok) {
      const purgeResult = (await purgeResponse.json()) as { ok: boolean };
      purged = purgeResult.ok;
      log.info("POST /api/local-db/sync-all: web database purged", { purged });
    } else {
      log.warn("POST /api/local-db/sync-all: purge failed", {
        status: purgeResponse.status,
      });
    }

    log.info("POST /api/local-db/sync-all: completed", {
      pulled: pullResult.pulled,
      failed: pullResult.failed,
      purged,
    });

    return NextResponse.json({
      ok: true,
      pulled: pullResult.pulled,
      failed: pullResult.failed,
      errors: pullResult.errors,
      purged,
    });
  } catch (error) {
    log.error("POST /api/local-db/sync-all: error", { error });
    return NextResponse.json(
      { error: "Erreur lors de la synchronisation" },
      { status: 500 },
    );
  }
}
