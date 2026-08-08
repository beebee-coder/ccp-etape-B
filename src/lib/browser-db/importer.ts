/**
 * Importeur de payload JSON vers la BDD browser SQLite-WASM.
 *
 * Reproduit la logique de `PullEngine.processPayload()` mais
 * exclusivement côté client, en utilisant l'API SQLite-WASM.
 *
 * @module browser-db/importer
 */

export interface ImportPayload {
  tables: {
    procedures?: Record<string, unknown>[];
    procedureSteps?: Record<string, unknown>[];
    alarms?: Record<string, unknown>[];
    alarmEvents?: Record<string, unknown>[];
    mediaItems?: Record<string, unknown>[];
    knowledgeItems?: Record<string, unknown>[];
    locationNodes?: Record<string, unknown>[];
    dataAssignments?: Record<string, unknown>[];
    guardrailRules?: Record<string, unknown>[];
    chromaIndex?: Record<string, unknown>[];
  };
}

export interface ImportResult {
  pulled: Record<string, number>;
  failed: number;
  errors: string[];
}

/** Sérialise en JSON si la valeur n'est pas déjà une string. */
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
    if (lower === "true" || lower === "1") return 1;
    if (lower === "false" || lower === "0") return 0;
  }
  if (value === 1) return 1;
  return 0;
}

/**
 * Exécute un INSERT OR REPLACE via l'API SQLite-WASM.
 * `db` est l'objet `oo1.DB` de @sqlite.org/sqlite-wasm.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exec(db: any, sql: string, params: unknown[]): void {
  db.exec({ sql, bind: params });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function importPayload(db: any, payload: ImportPayload): ImportResult {
  const result: ImportResult = { pulled: {}, failed: 0, errors: [] };
  const tables = payload.tables;

  // ── Procédures ──────────────────────────────────────────────────────────
  for (const p of tables.procedures ?? []) {
    try {
      exec(db, `
        INSERT INTO procedures
          (id, code, title, description, category, priority, location_type,
           location_path, bloc_code, equipement_code, metadata_json, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(code) DO UPDATE SET
          title           = excluded.title,
          description     = excluded.description,
          category        = excluded.category,
          priority        = excluded.priority,
          location_type   = excluded.location_type,
          location_path   = excluded.location_path,
          bloc_code       = excluded.bloc_code,
          equipement_code = excluded.equipement_code,
          metadata_json   = excluded.metadata_json,
          updated_at      = excluded.updated_at
      `, [
        p.id, p.code, p.title, p.description ?? null,
        p.category ?? "maintenance", p.priority ?? "moyenne",
        p.location_type ?? null, p.location_path ?? null,
        p.bloc_code ?? null, p.equipement_code ?? null,
        toJsonObject(p.metadata_json),
        p.created_at, p.updated_at,
      ]);

      // local_meta
      exec(db, `
        INSERT INTO local_meta
          (path, libelle, code, type, parent_id, sync_state, last_sync_at, description, tags, metadata)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(path) DO UPDATE SET
          libelle      = excluded.libelle,
          sync_state   = excluded.sync_state,
          last_sync_at = excluded.last_sync_at,
          updated_at   = CURRENT_TIMESTAMP
      `, [
        `procedure/${p.code}`,
        (p.title as string) || (p.code as string),
        p.code, "procedure", null, "synced",
        p.updated_at, (p.description as string) ?? "",
        "[]", "{}",
      ]);

      result.pulled.procedures = (result.pulled.procedures ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`procedure ${p.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Étapes de procédures ─────────────────────────────────────────────────
  for (const s of tables.procedureSteps ?? []) {
    try {
      exec(db, `
        INSERT INTO procedure_steps
          (id, procedure_id, step_order, step_id, title, subtitle, instructions,
           step_type, is_mandatory, dependencies, media_requirements, alarms,
           alarm_codes, attachments, timer_enabled, timer_seconds, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(procedure_id, step_order) DO UPDATE SET
          step_id            = excluded.step_id,
          title              = excluded.title,
          subtitle           = excluded.subtitle,
          instructions       = excluded.instructions,
          step_type          = excluded.step_type,
          is_mandatory       = excluded.is_mandatory,
          dependencies       = excluded.dependencies,
          media_requirements = excluded.media_requirements,
          alarms             = excluded.alarms,
          alarm_codes        = excluded.alarm_codes,
          attachments        = excluded.attachments,
          timer_enabled      = excluded.timer_enabled,
          timer_seconds      = excluded.timer_seconds,
          updated_at         = excluded.updated_at
      `, [
        s.id, s.procedure_id, s.step_order as number, s.step_id,
        s.title, s.subtitle ?? null, s.instructions ?? "",
        s.step_type ?? "standard",
        normalizeBoolean(s.is_mandatory),
        toJson(s.dependencies),
        toJsonObject(s.media_requirements),
        toJsonObject(s.alarms),
        toJson(s.alarm_codes),
        toJson(s.attachments),
        normalizeBoolean(s.timer_enabled),
        (s.timer_seconds as number) ?? 0,
        s.created_at, s.updated_at,
      ]);
      result.pulled.procedureSteps = (result.pulled.procedureSteps ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`procedure_step ${s.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Alarmes ──────────────────────────────────────────────────────────────
  for (const a of tables.alarms ?? []) {
    try {
      exec(db, `
        INSERT INTO alarms
          (id, code, bloc_code, equipement_code, location_type, location_path,
           groupe_path, type, severity, description, condition, remedy, status,
           triggered_at, resolved_at, metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(code) DO UPDATE SET
          bloc_code       = excluded.bloc_code,
          equipement_code = excluded.equipement_code,
          location_type   = excluded.location_type,
          location_path   = excluded.location_path,
          groupe_path     = excluded.groupe_path,
          type            = excluded.type,
          severity        = excluded.severity,
          description     = excluded.description,
          condition       = excluded.condition,
          remedy          = excluded.remedy,
          status          = excluded.status,
          triggered_at    = excluded.triggered_at,
          resolved_at     = excluded.resolved_at,
          metadata        = excluded.metadata,
          updated_at      = excluded.updated_at
      `, [
        a.id, a.code, a.bloc_code, a.equipement_code,
        a.location_type ?? "centrale", a.location_path,
        a.groupe_path ?? null, a.type, a.severity, a.description,
        a.condition ?? null, toJsonObject(a.remedy),
        a.status ?? "ACTIVE",
        a.triggered_at ?? null, a.resolved_at ?? null,
        toJsonObject(a.metadata),
        a.created_at, a.updated_at,
      ]);

      exec(db, `
        INSERT INTO local_meta
          (path, libelle, code, type, parent_id, sync_state, last_sync_at, description, tags, metadata)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(path) DO UPDATE SET
          libelle      = excluded.libelle,
          sync_state   = excluded.sync_state,
          last_sync_at = excluded.last_sync_at,
          updated_at   = CURRENT_TIMESTAMP
      `, [
        `alarm/${a.code}`,
        (a.description as string) || (a.code as string),
        a.code, "alarme", null, "synced",
        a.updated_at, (a.description as string) ?? "",
        "[]", "{}",
      ]);

      result.pulled.alarms = (result.pulled.alarms ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`alarm ${a.code}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Événements d'alarmes ─────────────────────────────────────────────────
  for (const e of tables.alarmEvents ?? []) {
    try {
      exec(db, `
        INSERT INTO alarm_events (id, alarm_id, event_type, occurred_at, operator_id, comment, metadata)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          alarm_id    = excluded.alarm_id,
          event_type  = excluded.event_type,
          occurred_at = excluded.occurred_at,
          operator_id = excluded.operator_id,
          comment     = excluded.comment,
          metadata    = excluded.metadata
      `, [
        e.id, e.alarm_id, e.event_type,
        e.occurred_at, e.operator_id ?? null,
        e.comment ?? null, toJsonObject(e.metadata),
      ]);
      result.pulled.alarmEvents = (result.pulled.alarmEvents ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`alarm_event ${e.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Médias ───────────────────────────────────────────────────────────────
  for (const m of tables.mediaItems ?? []) {
    try {
      exec(db, `
        INSERT INTO media_items
          (id, title, category, description, tags, kind, mime_type, size,
           data_url, thumbnail_url, location_type, location_path, bloc_code,
           equipement_code, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          title           = excluded.title,
          category        = excluded.category,
          description     = excluded.description,
          tags            = excluded.tags,
          kind            = excluded.kind,
          mime_type       = excluded.mime_type,
          size            = excluded.size,
          data_url        = excluded.data_url,
          thumbnail_url   = excluded.thumbnail_url,
          location_type   = excluded.location_type,
          location_path   = excluded.location_path,
          bloc_code       = excluded.bloc_code,
          equipement_code = excluded.equipement_code,
          updated_at      = excluded.updated_at
      `, [
        m.id, m.title, m.category, m.description ?? "",
        toJson(m.tags), m.kind, m.mime_type ?? null,
        m.size ?? null, m.data_url ?? null, m.thumbnail_url ?? null,
        m.location_type ?? null, m.location_path ?? null,
        m.bloc_code ?? null, m.equipement_code ?? null,
        m.created_at, m.updated_at,
      ]);
      result.pulled.mediaItems = (result.pulled.mediaItems ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`media ${m.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Knowledge Items ──────────────────────────────────────────────────────
  for (const k of tables.knowledgeItems ?? []) {
    try {
      exec(db, `
        INSERT INTO knowledge_items
          (id, user_id, type, title, question, answer, tags, category, content,
           created_at, updated_at, synced, vectorized)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          user_id    = excluded.user_id,
          type       = excluded.type,
          title      = excluded.title,
          question   = excluded.question,
          answer     = excluded.answer,
          tags       = excluded.tags,
          category   = excluded.category,
          content    = excluded.content,
          updated_at = excluded.updated_at,
          synced     = excluded.synced,
          vectorized = excluded.vectorized
      `, [
        k.id, k.user_id, k.type ?? "qa", k.title,
        k.question ?? null, k.answer ?? null,
        toJson(k.tags), k.category ?? null,
        k.content ?? null,
        k.created_at, k.updated_at,
        normalizeBoolean(k.synced), normalizeBoolean(k.vectorized),
      ]);
      result.pulled.knowledgeItems = (result.pulled.knowledgeItems ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`knowledge ${k.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Noeuds de localisation ───────────────────────────────────────────────
  for (const n of tables.locationNodes ?? []) {
    try {
      exec(db, `
        INSERT INTO location_nodes
          (id, location_type, path, bloc_code, equipement_code, groupe_code,
           libelle, parent_path, level, metadata, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(path) DO UPDATE SET
          location_type   = excluded.location_type,
          bloc_code       = excluded.bloc_code,
          equipement_code = excluded.equipement_code,
          groupe_code     = excluded.groupe_code,
          libelle         = excluded.libelle,
          parent_path     = excluded.parent_path,
          level           = excluded.level,
          metadata        = excluded.metadata,
          updated_at      = excluded.updated_at
      `, [
        n.id, n.location_type ?? "centrale", n.path,
        n.bloc_code ?? null, n.equipement_code ?? null,
        n.groupe_code ?? null, n.libelle ?? null,
        n.parent_path ?? null, (n.level as number) ?? 0,
        toJsonObject(n.metadata),
        n.created_at, n.updated_at,
      ]);
      result.pulled.locationNodes = (result.pulled.locationNodes ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`location_node ${n.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Data Assignments ─────────────────────────────────────────────────────
  for (const d of tables.dataAssignments ?? []) {
    try {
      exec(db, `
        INSERT INTO data_assignments
          (id, entity_type, entity_id, location_type, location_path, file_path, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          entity_type   = excluded.entity_type,
          entity_id     = excluded.entity_id,
          location_type = excluded.location_type,
          location_path = excluded.location_path,
          file_path     = excluded.file_path,
          updated_at    = excluded.updated_at
      `, [
        d.id, d.entity_type, d.entity_id,
        d.location_type, d.location_path,
        d.file_path ?? null,
        d.created_at, d.updated_at,
      ]);
      result.pulled.dataAssignments = (result.pulled.dataAssignments ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`data_assignment ${d.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Guardrail Rules ──────────────────────────────────────────────────────
  for (const g of tables.guardrailRules ?? []) {
    try {
      exec(db, `
        INSERT INTO guardrail_rules (id, section, rule, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET
          section    = excluded.section,
          rule       = excluded.rule,
          is_active  = excluded.is_active,
          updated_at = excluded.updated_at
      `, [
        g.id, g.section, g.rule,
        normalizeBoolean(g.is_active),
        g.created_at, g.updated_at,
      ]);
      result.pulled.guardrailRules = (result.pulled.guardrailRules ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`guardrail ${g.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ── Chroma Index ─────────────────────────────────────────────────────────
  for (const c of tables.chromaIndex ?? []) {
    try {
      const embedding = c.embedding as unknown;
      const embeddingJson = Array.isArray(embedding)
        ? JSON.stringify(embedding)
        : typeof embedding === "string"
        ? embedding
        : "[]";

      exec(db, `
        INSERT INTO chroma_index (id, collection, document_id, content, metadata_json, embedding, created_at)
        VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(document_id) DO UPDATE SET
          collection    = excluded.collection,
          content       = excluded.content,
          metadata_json = excluded.metadata_json,
          embedding     = excluded.embedding,
          created_at    = excluded.created_at
      `, [
        c.id, c.collection, c.document_id,
        c.content, toJsonObject(c.metadata_json),
        embeddingJson, c.created_at,
      ]);
      result.pulled.chromaIndex = (result.pulled.chromaIndex ?? 0) + 1;
    } catch (error) {
      result.failed++;
      result.errors.push(`chroma ${c.document_id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Met à jour le manifest
  try {
    const totalPulled = Object.values(result.pulled).reduce((a, b) => a + b, 0);
    exec(db, `
      UPDATE sync_manifest SET
        last_sync     = CURRENT_TIMESTAMP,
        source        = 'vercel-export',
        synced_count  = synced_count + ?,
        failed_count  = failed_count + ?
      WHERE id = 1
    `, [totalPulled, result.failed]);
  } catch {
    // non bloquant
  }

  return result;
}
