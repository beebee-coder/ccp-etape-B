import { LocalDataSource } from "./data-source";
import { createLogger } from "@/lib/logger";

const log = createLogger({ module: "pull-engine" });

export interface PullResult {
  pulled: Record<string, number>;
  failed: number;
  errors: string[];
}

function toJson(value: unknown): string {
  if (value === null || value === undefined) return "[]";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function toJsonObject(value: unknown): string {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function normalizeBoolean(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true" || lower === "1" || lower === "t") return 1;
    if (lower === "false" || lower === "0" || lower === "f") return 0;
  }
  return value === true ? 1 : 0;
}

export class PullEngine {
  private static instance: PullEngine | null = null;
  private dataSource: LocalDataSource;
  private pullEndpoint: string;

  private constructor() {
    this.dataSource = LocalDataSource.getInstance();
    this.pullEndpoint = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/local-db/export`
      : "/api/local-db/export";
  }

  static getInstance(): PullEngine {
    if (!PullEngine.instance) {
      PullEngine.instance = new PullEngine();
    }
    return PullEngine.instance;
  }

  processPayload(payload: {
    tables: Record<string, Record<string, unknown>[]>;
  }): PullResult {
    const result: PullResult = {
      pulled: {},
      failed: 0,
      errors: [],
    };

    const db = this.dataSource.getDb();
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    const insertLocalMeta = db.prepare(`
      INSERT INTO local_meta (path, libelle, code, type, parent_id, sync_state, last_sync_at, description, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        libelle = excluded.libelle,
        code = excluded.code,
        type = excluded.type,
        parent_id = excluded.parent_id,
        sync_state = excluded.sync_state,
        last_sync_at = excluded.last_sync_at,
        description = excluded.description,
        tags = excluded.tags,
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertProcedure = db.prepare(`
      INSERT INTO procedures (id, code, title, description, category, priority, location_type, location_path, bloc_code, equipement_code, metadata_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        category = excluded.category,
        priority = excluded.priority,
        location_type = excluded.location_type,
        location_path = excluded.location_path,
        bloc_code = excluded.bloc_code,
        equipement_code = excluded.equipement_code,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `);

    const upsertProcedureStep = db.prepare(`
      INSERT INTO procedure_steps (id, procedure_id, step_order, step_id, title, subtitle, instructions, step_type, is_mandatory, dependencies, media_requirements, alarms, alarm_codes, attachments, timer_enabled, timer_seconds, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(procedure_id, step_order) DO UPDATE SET
        step_id = excluded.step_id,
        title = excluded.title,
        subtitle = excluded.subtitle,
        instructions = excluded.instructions,
        step_type = excluded.step_type,
        is_mandatory = excluded.is_mandatory,
        dependencies = excluded.dependencies,
        media_requirements = excluded.media_requirements,
        alarms = excluded.alarms,
        alarm_codes = excluded.alarm_codes,
        attachments = excluded.attachments,
        timer_enabled = excluded.timer_enabled,
        timer_seconds = excluded.timer_seconds,
        updated_at = excluded.updated_at
    `);

    const upsertAlarm = db.prepare(`
      INSERT INTO alarms (id, code, bloc_code, equipement_code, location_type, location_path, groupe_path, type, severity, description, condition, remedy, status, triggered_at, resolved_at, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        bloc_code = excluded.bloc_code,
        equipement_code = excluded.equipement_code,
        location_type = excluded.location_type,
        location_path = excluded.location_path,
        groupe_path = excluded.groupe_path,
        type = excluded.type,
        severity = excluded.severity,
        description = excluded.description,
        condition = excluded.condition,
        remedy = excluded.remedy,
        status = excluded.status,
        triggered_at = excluded.triggered_at,
        resolved_at = excluded.resolved_at,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    const upsertAlarmEvent = db.prepare(`
      INSERT INTO alarm_events (id, alarm_id, event_type, occurred_at, operator_id, comment, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        alarm_id = excluded.alarm_id,
        event_type = excluded.event_type,
        occurred_at = excluded.occurred_at,
        operator_id = excluded.operator_id,
        comment = excluded.comment,
        metadata = excluded.metadata
    `);

    const upsertMedia = db.prepare(`
      INSERT INTO media_items (id, title, category, description, tags, kind, mime_type, size, data_url, thumbnail_url, location_type, location_path, bloc_code, equipement_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        description = excluded.description,
        tags = excluded.tags,
        kind = excluded.kind,
        mime_type = excluded.mime_type,
        size = excluded.size,
        data_url = excluded.data_url,
        thumbnail_url = excluded.thumbnail_url,
        location_type = excluded.location_type,
        location_path = excluded.location_path,
        bloc_code = excluded.bloc_code,
        equipement_code = excluded.equipement_code,
        updated_at = excluded.updated_at
    `);

    const upsertKnowledge = db.prepare(`
      INSERT INTO knowledge_items (id, user_id, type, title, question, answer, tags, category, content, synced, vectorized, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        type = excluded.type,
        title = excluded.title,
        question = excluded.question,
        answer = excluded.answer,
        tags = excluded.tags,
        category = excluded.category,
        content = excluded.content,
        synced = excluded.synced,
        vectorized = excluded.vectorized,
        updated_at = excluded.updated_at
    `);

    const upsertLocationNode = db.prepare(`
      INSERT INTO location_nodes (id, location_type, path, bloc_code, equipement_code, groupe_code, libelle, parent_path, level, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        location_type = excluded.location_type,
        bloc_code = excluded.bloc_code,
        equipement_code = excluded.equipement_code,
        groupe_code = excluded.groupe_code,
        libelle = excluded.libelle,
        parent_path = excluded.parent_path,
        level = excluded.level,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    const upsertDataAssignment = db.prepare(`
      INSERT INTO data_assignments (id, entity_type, entity_id, location_type, location_path, file_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        entity_type = excluded.entity_type,
        entity_id = excluded.entity_id,
        location_type = excluded.location_type,
        location_path = excluded.location_path,
        file_path = excluded.file_path,
        updated_at = excluded.updated_at
    `);

    const upsertGuardrail = db.prepare(`
      INSERT INTO guardrail_rules (id, section, rule, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        section = excluded.section,
        rule = excluded.rule,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at
    `);

    const upsertChroma = db.prepare(`
      INSERT INTO chroma_index (id, collection, document_id, content, metadata_json, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(document_id) DO UPDATE SET
        collection = excluded.collection,
        content = excluded.content,
        metadata_json = excluded.metadata_json,
        embedding = excluded.embedding,
        created_at = excluded.created_at
    `);

    const tables = payload.tables;

    for (const procedure of tables.procedures ?? []) {
      try {
        upsertProcedure.run(
          procedure.id as string,
          procedure.code as string,
          procedure.title as string,
          procedure.description as string | null,
          procedure.category as string,
          procedure.priority as string,
          procedure.location_type as string | null,
          procedure.location_path as string | null,
          procedure.bloc_code as string | null,
          procedure.equipement_code as string | null,
          toJsonObject(procedure.metadata_json),
          procedure.created_at as string,
          procedure.updated_at as string,
        );
        insertLocalMeta.run(
          `procedure/${procedure.code}`,
          (procedure.title as string) || (procedure.code as string),
          procedure.code as string,
          "procedure",
          null,
          "synced",
          procedure.updated_at as string,
          (procedure.description as string) || "",
          "[]",
          "{}",
        );
        result.pulled.procedures = (result.pulled.procedures || 0) + 1;
      } catch (error) {
        result.failed++;
        result.errors.push(`procedure ${procedure.code}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const step of tables.procedureSteps ?? []) {
      try {
        upsertProcedureStep.run(
          step.id as string,
          step.procedure_id as string,
          step.step_order as number,
          step.step_id as string,
          step.title as string,
          step.subtitle as string | null,
          step.instructions as string,
          step.step_type as string,
          normalizeBoolean(step.is_mandatory),
          toJson(step.dependencies),
          toJsonObject(step.media_requirements),
          toJsonObject(step.alarms),
          toJson(step.alarm_codes),
          toJson(step.attachments),
          normalizeBoolean(step.timer_enabled),
          (step.timer_seconds as number) || 0,
          step.created_at as string,
          step.updated_at as string,
        );
      } catch (error) {
        result.failed++;
        result.errors.push(`procedure_step ${step.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const alarm of tables.alarms ?? []) {
      try {
        upsertAlarm.run(
          alarm.id as string,
          alarm.code as string,
          alarm.bloc_code as string,
          alarm.equipement_code as string,
          alarm.location_type as string,
          alarm.location_path as string,
          alarm.groupe_path as string | null,
          alarm.type as string,
          alarm.severity as string,
          alarm.description as string,
          alarm.condition as string | null,
          toJsonObject(alarm.remedy),
          alarm.status as string,
          alarm.triggered_at as string | null,
          alarm.resolved_at as string | null,
          toJsonObject(alarm.metadata),
          alarm.created_at as string,
          alarm.updated_at as string,
        );
        insertLocalMeta.run(
          `alarm/${alarm.code}`,
          (alarm.description as string) || alarm.code as string,
          alarm.code as string,
          "alarme",
          null,
          "synced",
          alarm.updated_at as string,
          (alarm.description as string) || "",
          "[]",
          "{}",
        );
        result.pulled.alarms = (result.pulled.alarms || 0) + 1;
      } catch (error) {
        result.failed++;
        result.errors.push(`alarm ${alarm.code}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const event of tables.alarmEvents ?? []) {
      try {
        upsertAlarmEvent.run(
          event.id as string,
          event.alarm_id as string,
          event.event_type as string,
          event.occurred_at as string,
          event.operator_id as string | null,
          event.comment as string | null,
          toJsonObject(event.metadata),
        );
      } catch (error) {
        result.failed++;
        result.errors.push(`alarm_event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const media of tables.mediaItems ?? []) {
      try {
        upsertMedia.run(
          media.id as string,
          media.title as string,
          media.category as string,
          media.description as string,
          toJson(media.tags),
          media.kind as string,
          media.mime_type as string,
          media.size as number,
          media.data_url as string,
          media.thumbnail_url as string | null,
          media.location_type as string | null,
          media.location_path as string | null,
          media.bloc_code as string | null,
          media.equipement_code as string | null,
          media.created_at as string,
          media.updated_at as string,
        );
        insertLocalMeta.run(
          `media/${media.id}`,
          media.title as string,
          media.id as string,
          "document",
          null,
          "synced",
          media.updated_at as string,
          (media.description as string) || "",
          toJson(media.tags),
          "{}",
        );
        result.pulled.mediaItems = (result.pulled.mediaItems || 0) + 1;
      } catch (error) {
        result.failed++;
        result.errors.push(`media ${media.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const item of tables.knowledgeItems ?? []) {
      try {
        upsertKnowledge.run(
          item.id as string,
          item.user_id as string,
          item.type as string,
          item.title as string,
          item.question as string | null,
          item.answer as string | null,
          toJson(item.tags),
          item.category as string | null,
          item.content as string | null,
          normalizeBoolean(item.synced),
          normalizeBoolean(item.vectorized),
          item.created_at as string,
          item.updated_at as string,
        );
        result.pulled.knowledgeItems = (result.pulled.knowledgeItems || 0) + 1;
      } catch (error) {
        result.failed++;
        result.errors.push(`knowledge ${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const node of tables.locationNodes ?? []) {
      try {
        upsertLocationNode.run(
          node.id as string,
          node.location_type as string,
          node.path as string,
          node.bloc_code as string | null,
          node.equipement_code as string | null,
          node.groupe_code as string | null,
          node.libelle as string | null,
          node.parent_path as string | null,
          (node.level as number) || 0,
          toJsonObject(node.metadata),
          node.created_at as string,
          node.updated_at as string,
        );
        insertLocalMeta.run(
          node.path as string,
          (node.libelle as string) || node.path,
          node.path as string,
          node.location_type as string,
          node.parent_path as string | null,
          "synced",
          node.updated_at as string,
          "",
          "[]",
          toJsonObject(node.metadata),
        );
        result.pulled.locationNodes = (result.pulled.locationNodes || 0) + 1;
      } catch (error) {
        result.failed++;
        result.errors.push(`location_node ${node.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const assignment of tables.dataAssignments ?? []) {
      try {
        upsertDataAssignment.run(
          assignment.id as string,
          assignment.entity_type as string,
          assignment.entity_id as string,
          assignment.location_type as string,
          assignment.location_path as string,
          assignment.file_path as string | null,
          assignment.created_at as string,
          assignment.updated_at as string,
        );
      } catch (error) {
        result.failed++;
        result.errors.push(`data_assignment ${assignment.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const rule of tables.guardrailRules ?? []) {
      try {
        upsertGuardrail.run(
          rule.id as string,
          rule.section as string,
          rule.rule as string,
          normalizeBoolean(rule.is_active),
          rule.created_at as string,
          rule.updated_at as string,
        );
      } catch (error) {
        result.failed++;
        result.errors.push(`guardrail ${rule.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    for (const chroma of tables.chromaIndex ?? []) {
      try {
        const embedding = chroma.embedding as unknown;
        let embeddingJson: string;
        if (Array.isArray(embedding)) {
          embeddingJson = JSON.stringify(embedding);
        } else if (typeof embedding === "string") {
          embeddingJson = embedding;
        } else {
          embeddingJson = "[]";
        }
        upsertChroma.run(
          chroma.id as string,
          chroma.collection as string,
          chroma.document_id as string,
          chroma.content as string,
          toJsonObject(chroma.metadata_json),
          embeddingJson,
          chroma.created_at as string,
        );
      } catch (error) {
        result.failed++;
        result.errors.push(`chroma ${chroma.document_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    log.info("Pull completed", { result: result as unknown });
    return result;
  }

  async pull(): Promise<PullResult> {
    try {
      log.info("Starting pull from web database");
      const response = await fetch(this.pullEndpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Export endpoint responded with ${response.status}: ${text}`);
      }

      const payload = (await response.json()) as {
        tables: Record<string, Record<string, unknown>[]>;
        counts: Record<string, number>;
      };

      return this.processPayload(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      log.error("Pull failed", { error });
      return {
        pulled: {},
        failed: 1,
        errors: [message],
      };
    }
  }

  async purgeWeb(): Promise<boolean> {
    const purgeEndpoint = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL}/api/local-db/purge`
      : "/api/local-db/purge";

    try {
      log.info("Purging web database");
      const response = await fetch(purgeEndpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Purge endpoint responded with ${response.status}: ${text}`);
      }

      const result = (await response.json()) as { ok: boolean };
      log.info("Web database purged successfully");
      return result.ok;
    } catch (error) {
      log.error("Purge failed", { error });
      return false;
    }
  }

  async pullAndPurge(): Promise<PullResult & { purged: boolean }> {
    const pullResult = await this.pull();
    if (pullResult.failed > 0 && Object.keys(pullResult.pulled).length === 0) {
      return { ...pullResult, purged: false };
    }

    const purged = await this.purgeWeb();
    return { ...pullResult, purged };
  }
}
