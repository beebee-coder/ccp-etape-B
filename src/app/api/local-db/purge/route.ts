import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "api-local-db-purge" });

const PURGE_TABLES = [
  "procedure_steps",
  "procedure_executions",
  "alarm_events",
  "chroma_index",
  "q_r_uploads",
  "procedures",
  "alarms",
  "media_items",
  "knowledge_items",
  "location_nodes",
  "data_assignments",
  "guardrail_rules",
  "chat_messages",
  "meeting_chat_messages",
  "meetings",
  "iot_sensor_readings",
  "iot_actuators",
  "iot_devices",
  "workflow_steps",
  "executions",
  "workflows",
  "integrations",
  "audit_logs",
  "reports",
  "team_members",
  "teams",
  "etat_des_lieux_reports",
  "users",
];

export async function DELETE() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const results: Record<string, number> = {};
    for (const table of PURGE_TABLES) {
      const result = await client.query(`DELETE FROM ${table}`);
      results[table] = result.rowCount ?? 0;
    }

    await client.query("COMMIT");

    log.info("DELETE /api/local-db/purge: database purged", { results });

    return NextResponse.json({
      ok: true,
      message: "Base de données web purgée avec succès",
      purged: results,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    log.error("DELETE /api/local-db/purge: error", { error });
    return NextResponse.json(
      { error: "Erreur lors de la purge de la base de données" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
