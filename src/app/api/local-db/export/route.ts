import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-export" });

export async function GET() {
  try {
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
      exportedAt: new Date().toISOString(),
      tables: {
        procedures: procedures.rows,
        procedureSteps: procedureSteps.rows,
        alarms: alarms.rows,
        alarmEvents: alarmEvents.rows,
        mediaItems: mediaItems.rows,
        knowledgeItems: knowledgeItems.rows,
        locationNodes: locationNodes.rows,
        dataAssignments: dataAssignments.rows,
        guardrailRules: guardrailRules.rows,
        chromaIndex: chromaIndex.rows,
      },
      counts: {
        procedures: procedures.rowCount,
        procedureSteps: procedureSteps.rowCount,
        alarms: alarms.rowCount,
        alarmEvents: alarmEvents.rowCount,
        mediaItems: mediaItems.rowCount,
        knowledgeItems: knowledgeItems.rowCount,
        locationNodes: locationNodes.rowCount,
        dataAssignments: dataAssignments.rowCount,
        guardrailRules: guardrailRules.rowCount,
        chromaIndex: chromaIndex.rowCount,
      },
    };

    log.info("GET /api/local-db/export: data exported", {
      counts: payload.counts,
    });

    return NextResponse.json(payload);
  } catch (error) {
    log.error("GET /api/local-db/export: error", { error });
    return NextResponse.json(
      { error: "Erreur lors de l'export des données" },
      { status: 500 },
    );
  }
}
