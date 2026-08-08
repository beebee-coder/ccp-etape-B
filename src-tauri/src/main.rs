// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dirs::config_dir;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::str::FromStr;

#[derive(Debug, Serialize, Deserialize)]
pub struct PullResult {
    pub pulled: HashMap<String, usize>,
    pub failed: usize,
    pub errors: Vec<String>,
    pub purged: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DbInfo {
    pub exists: bool,
    pub path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Deserialize)]
pub struct ExportPayload {
    pub tables: HashMap<String, Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
pub struct PurgeResponse {
    pub ok: bool,
    pub message: Option<String>,
}

fn get_app_dir() -> PathBuf {
    let mut path = config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("CCP-Etape-B");
    path
}

fn ensure_app_dir() -> Result<PathBuf, String> {
    let app_dir = get_app_dir();
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    Ok(app_dir)
}

fn get_db_path() -> Result<PathBuf, String> {
    let app_dir = ensure_app_dir()?;
    Ok(app_dir.join("visionode.sqlite"))
}

async fn init_pool(db_path_str: &str) -> Result<Pool<Sqlite>, String> {
    let connection_string = format!("sqlite:{}?mode=rwc", db_path_str);
    let options = SqliteConnectOptions::from_str(&connection_string)
        .map_err(|e| e.to_string())?
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .connect_with(options)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("PRAGMA journal_mode = WAL;")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    create_tables(&pool).await?;

    Ok(pool)
}

async fn create_tables(pool: &Pool<Sqlite>) -> Result<(), String> {
    let schema = r#"
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email           VARCHAR(255) NOT NULL UNIQUE,
      password_hash   VARCHAR(255) NOT NULL,
      name            VARCHAR(100),
      role            VARCHAR(50) NOT NULL DEFAULT 'user',
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS procedures (
      id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      code                VARCHAR(100) NOT NULL UNIQUE,
      title               VARCHAR(255) NOT NULL,
      description         TEXT,
      category            VARCHAR(100) NOT NULL,
      priority            VARCHAR(20) NOT NULL DEFAULT 'moyenne',
      estimated_time_min  INTEGER NOT NULL DEFAULT 30,
      required_roles      TEXT NOT NULL DEFAULT '[]',
      global_safety_instructions TEXT NOT NULL DEFAULT '[]',
      metadata_json       TEXT NOT NULL DEFAULT '{}',
      created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_procedures_code ON procedures(code);
    CREATE INDEX IF NOT EXISTS idx_procedures_category ON procedures(category);

    CREATE TABLE IF NOT EXISTS procedure_steps (
      id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      procedure_id      TEXT NOT NULL,
      step_order        INTEGER NOT NULL,
      step_id           VARCHAR(100) NOT NULL,
      title             VARCHAR(255) NOT NULL,
      subtitle          TEXT,
      instructions      TEXT NOT NULL,
      step_type         VARCHAR(50) NOT NULL DEFAULT 'consigne_simple',
      is_mandatory      INTEGER NOT NULL DEFAULT 0,
      dependencies      TEXT NOT NULL DEFAULT '[]',
      media_requirements TEXT NOT NULL DEFAULT '[]',
      alarms            TEXT NOT NULL DEFAULT '[]',
      attachments       TEXT NOT NULL DEFAULT '[]',
      timer_enabled     INTEGER NOT NULL DEFAULT 0,
      timer_seconds     INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_procedure_steps_procedure ON procedure_steps(procedure_id);
    CREATE INDEX IF NOT EXISTS idx_procedure_steps_order ON procedure_steps(procedure_id, step_order);

    CREATE TABLE IF NOT EXISTS procedure_executions (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      procedure_id    TEXT NOT NULL,
      procedure_code  VARCHAR(100) NOT NULL,
      operator_id     TEXT NOT NULL,
      start_time      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      end_time        TEXT,
      status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
      steps_status    TEXT NOT NULL DEFAULT '[]',
      total_duration  INTEGER DEFAULT 0,
      current_step    INTEGER,
      alarms          TEXT DEFAULT '[]',
      fallbacks       TEXT DEFAULT '[]',
      events          TEXT DEFAULT '[]',
      signature       TEXT,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_procedure_executions_procedure ON procedure_executions(procedure_id);
    CREATE INDEX IF NOT EXISTS idx_procedure_executions_operator ON procedure_executions(operator_id);
    CREATE INDEX IF NOT EXISTS idx_procedure_executions_status ON procedure_executions(status);
    CREATE INDEX IF NOT EXISTS idx_procedure_executions_created ON procedure_executions(created_at);
    CREATE INDEX IF NOT EXISTS idx_procedure_executions_procedure_code ON procedure_executions(procedure_code);

    CREATE TABLE IF NOT EXISTS etat_des_lieux_reports (
      id              VARCHAR(100) PRIMARY KEY,
      title           VARCHAR(255) NOT NULL,
      description     TEXT NOT NULL,
      location        VARCHAR(255) NOT NULL,
      attachments     TEXT NOT NULL DEFAULT '[]',
      status          VARCHAR(20) NOT NULL DEFAULT 'draft',
      author_name     VARCHAR(100) NOT NULL,
      author_role     VARCHAR(100) NOT NULL,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_edl_status ON etat_des_lieux_reports(status);
    CREATE INDEX IF NOT EXISTS idx_edl_author ON etat_des_lieux_reports(author_role);

    CREATE TABLE IF NOT EXISTS media_items (
      id              VARCHAR(100) PRIMARY KEY,
      title           VARCHAR(255) NOT NULL,
      category        VARCHAR(100) NOT NULL,
      description     TEXT DEFAULT '',
      tags            TEXT NOT NULL DEFAULT '[]',
      kind            VARCHAR(20) NOT NULL DEFAULT 'image',
      mime_type       VARCHAR(100) NOT NULL,
      size            INTEGER NOT NULL,
      data_url        TEXT NOT NULL,
      thumbnail_url   TEXT,
      location_type   VARCHAR(20),
      location_path   VARCHAR(200),
      bloc_code       VARCHAR(10),
      equipement_code VARCHAR(50),
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_media_category ON media_items(category);
    CREATE INDEX IF NOT EXISTS idx_media_kind ON media_items(kind);

    CREATE TABLE IF NOT EXISTS workflows (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id       TEXT NOT NULL,
      name          VARCHAR(150) NOT NULL,
      status        VARCHAR(50) NOT NULL DEFAULT 'draft',
      trigger_type  VARCHAR(50),
      config        TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id   TEXT NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      action_type   VARCHAR(50) NOT NULL,
      config        TEXT DEFAULT '{}',
      next_step_id  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);

    CREATE TABLE IF NOT EXISTS executions (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      workflow_id     TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      current_step_id TEXT,
      status          VARCHAR(50) NOT NULL DEFAULT 'running',
      started_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at     TEXT,
      error           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_executions_user ON executions(user_id);
    CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

    CREATE TABLE IF NOT EXISTS integrations (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id       TEXT NOT NULL,
      service       VARCHAR(50) NOT NULL,
      credentials   TEXT DEFAULT '{}',
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id       TEXT,
      action        VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50),
      resource_id   TEXT,
      metadata      TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

    CREATE TABLE IF NOT EXISTS chroma_index (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      collection    VARCHAR(100) NOT NULL,
      document_id   VARCHAR(100) NOT NULL,
      content       TEXT NOT NULL,
      metadata_json TEXT DEFAULT '{}',
      embedding     TEXT DEFAULT '[]',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
    CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

    CREATE TABLE IF NOT EXISTS guardrail_rules (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      section       VARCHAR(50) NOT NULL DEFAULT 'general',
      rule          TEXT NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_guardrail_section ON guardrail_rules(section);
    CREATE INDEX IF NOT EXISTS idx_guardrail_active ON guardrail_rules(is_active);

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id   TEXT NOT NULL,
      type      TEXT NOT NULL,
      title     TEXT NOT NULL,
      question  TEXT,
      answer    TEXT,
      tags      TEXT NOT NULL DEFAULT '[]',
      category  TEXT,
      location_type VARCHAR(20),
      location_path VARCHAR(200),
      bloc_code VARCHAR(10),
      equipement_code VARCHAR(50),
      synced    INTEGER NOT NULL DEFAULT 0,
      vectorized INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      content   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(type);
    CREATE INDEX IF NOT EXISTS idx_knowledge_user_type ON knowledge_items(user_id, type);

    CREATE TABLE IF NOT EXISTS q_r_uploads (
      id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id   TEXT NOT NULL,
      file_name TEXT NOT NULL,
      set_name  TEXT NOT NULL,
      version   INTEGER NOT NULL DEFAULT 1,
      directory TEXT NOT NULL,
      file_path TEXT NOT NULL,
      qa_count  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_qr_uploads_user ON q_r_uploads(user_id);
    CREATE INDEX IF NOT EXISTS idx_qr_uploads_set_name ON q_r_uploads(set_name);

    CREATE TABLE IF NOT EXISTS iot_devices (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      connection_type  TEXT NOT NULL DEFAULT 'wireless',
      connection_status TEXT NOT NULL DEFAULT 'disconnected',
      rssi             INTEGER,
      sensors_json     TEXT NOT NULL DEFAULT '{}',
      created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(connection_status);

    CREATE TABLE IF NOT EXISTS iot_actuators (
      id          TEXT PRIMARY KEY,
      device_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      state       TEXT NOT NULL DEFAULT 'idle',
      enabled     INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_iot_actuators_device ON iot_actuators(device_id);

    CREATE TABLE IF NOT EXISTS iot_sensor_readings (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      device_id    TEXT NOT NULL,
      reading_json TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_iot_readings_device ON iot_sensor_readings(device_id);
    CREATE INDEX IF NOT EXISTS idx_iot_readings_created ON iot_sensor_readings(created_at);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id         TEXT NOT NULL,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      provider        TEXT,
      timestamp       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      media           TEXT,
      procedure_id    TEXT,
      source          TEXT,
      client_id       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_procedure ON chat_messages(procedure_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_client ON chat_messages(client_id);

    CREATE TABLE IF NOT EXISTS teams (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      color       TEXT NOT NULL DEFAULT 'bg-blue-500',
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

    CREATE TABLE IF NOT EXISTS team_members (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id    INTEGER NOT NULL,
      name       TEXT NOT NULL,
      email      TEXT,
      role       TEXT NOT NULL DEFAULT 'user',
      status     TEXT NOT NULL DEFAULT 'active',
      avatar     TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

    CREATE TABLE IF NOT EXISTS reports (
      id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      date       TEXT NOT NULL,
      points     TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

    CREATE TABLE IF NOT EXISTS meetings (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title           TEXT NOT NULL,
      started_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at        TEXT,
      created_by      TEXT NOT NULL,
      participants    TEXT NOT NULL DEFAULT '[]',
      recording_url   TEXT,
      created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_meetings_started ON meetings(started_at);
    CREATE INDEX IF NOT EXISTS idx_meetings_ended ON meetings(ended_at);
    CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

    CREATE TABLE IF NOT EXISTS meeting_chat_messages (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      meeting_id    TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      user_name     TEXT NOT NULL,
      user_initials TEXT NOT NULL,
      is_self       INTEGER NOT NULL DEFAULT 0,
      text          TEXT NOT NULL,
      timestamp     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_meeting_chat_meeting ON meeting_chat_messages(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_chat_user ON meeting_chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_chat_timestamp ON meeting_chat_messages(timestamp);

    CREATE TABLE IF NOT EXISTS local_meta (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      path          TEXT NOT NULL UNIQUE,
      libelle       TEXT NOT NULL,
      code          TEXT NOT NULL,
      type          TEXT NOT NULL,
      parent_id     TEXT,
      sync_state    TEXT NOT NULL DEFAULT 'local-only',
      last_sync_at  TEXT,
      description   TEXT,
      tags          TEXT NOT NULL DEFAULT '[]',
      metadata      TEXT NOT NULL DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_local_meta_path ON local_meta(path);
    CREATE INDEX IF NOT EXISTS idx_local_meta_type ON local_meta(type);
    CREATE INDEX IF NOT EXISTS idx_local_meta_sync_state ON local_meta(sync_state);
    CREATE INDEX IF NOT EXISTS idx_local_meta_parent ON local_meta(parent_id);

    CREATE TABLE IF NOT EXISTS sync_queue (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      operation     TEXT NOT NULL,
      entity        TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      data          TEXT NOT NULL DEFAULT '{}',
      timestamp     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status        TEXT NOT NULL DEFAULT 'pending',
      retry_count   INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity, entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);

    CREATE TABLE IF NOT EXISTS sync_manifest (
      id            INTEGER PRIMARY KEY CHECK (id = 1),
      version       TEXT NOT NULL,
      last_sync     TEXT,
      pending_count INTEGER NOT NULL DEFAULT 0,
      synced_count  INTEGER NOT NULL DEFAULT 0,
      failed_count  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS alarms (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      code          TEXT NOT NULL UNIQUE,
      bloc_code     TEXT NOT NULL,
      equipement_code TEXT NOT NULL,
      location_type TEXT NOT NULL,
      location_path TEXT NOT NULL,
      groupe_path   TEXT,
      type          TEXT NOT NULL,
      severity      TEXT NOT NULL,
      description   TEXT NOT NULL,
      condition     TEXT,
      remedy        TEXT DEFAULT '{}',
      status        TEXT NOT NULL DEFAULT 'ACTIVE',
      triggered_at  TEXT,
      resolved_at   TEXT,
      metadata      TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alarms_location ON alarms(location_type, location_path);
    CREATE INDEX IF NOT EXISTS idx_alarms_bloc ON alarms(bloc_code);
    CREATE INDEX IF NOT EXISTS idx_alarms_code ON alarms(code);
    CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);

    CREATE TABLE IF NOT EXISTS alarm_events (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      alarm_id      TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      occurred_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      operator_id   TEXT,
      comment       TEXT,
      metadata      TEXT DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_alarm_events_alarm ON alarm_events(alarm_id);
    CREATE INDEX IF NOT EXISTS idx_alarm_events_occurred ON alarm_events(occurred_at);

    CREATE TABLE IF NOT EXISTS location_nodes (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      location_type TEXT NOT NULL,
      path          TEXT UNIQUE NOT NULL,
      bloc_code     TEXT,
      equipement_code TEXT,
      groupe_code   TEXT,
      libelle       TEXT,
      parent_path   TEXT,
      level         INTEGER NOT NULL DEFAULT 0,
      metadata      TEXT DEFAULT '{}',
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_location_nodes_type ON location_nodes(location_type);
    CREATE INDEX IF NOT EXISTS idx_location_nodes_path ON location_nodes(path);
    CREATE INDEX IF NOT EXISTS idx_location_nodes_bloc ON location_nodes(bloc_code);

    CREATE TABLE IF NOT EXISTS data_assignments (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      location_type TEXT NOT NULL,
      location_path TEXT NOT NULL,
      file_path     TEXT,
      created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_data_assignments_entity ON data_assignments(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_data_assignments_location ON data_assignments(location_type, location_path);
    "#;

    sqlx::query(schema)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

async fn run_background_chroma_indexer(pool: Pool<Sqlite>) {
    log::info!("Initialisation de la tâche d'arrière-plan Chroma DB Indexer");

    let result = sqlx::query(
        r#"
        INSERT INTO chroma_index (id, collection, document_id, content, metadata_json, embedding)
        SELECT 
            'ki_' || id,
            'knowledge',
            id,
            content,
            json_object('title', title, 'category', category),
            '[]'
        FROM knowledge_items
        WHERE 'ki_' || id NOT IN (SELECT id FROM chroma_index)
        "#
    )
    .execute(&pool)
    .await;

    match result {
        Ok(res) => log::info!("Chroma DB background indexer: {} document(s) indexés", res.rows_affected()),
        Err(err) => log::warn!("Avertissement Chroma DB background indexer: {}", err),
    }
}

#[tauri::command]
async fn get_local_db_path() -> Result<String, String> {
    let path_buf = get_db_path()?;
    Ok(path_buf.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_local_db_info() -> Result<DbInfo, String> {
    let db_path_buf = get_db_path()?;
    let path_str = db_path_buf.to_string_lossy().to_string();
    let exists = db_path_buf.exists();
    let size_bytes = if exists {
        fs::metadata(&db_path_buf)
            .map(|m| m.len())
            .unwrap_or(0)
    } else {
        0
    };

    Ok(DbInfo {
        exists,
        path: path_str,
        size_bytes,
    })
}

#[tauri::command]
async fn initialize_database() -> Result<String, String> {
    let db_path_buf = get_db_path()?;
    let path_str = db_path_buf.to_string_lossy().to_string();

    let pool = init_pool(&path_str).await?;

    let background_pool = pool.clone();
    tauri::async_runtime::spawn(async move {
        run_background_chroma_indexer(background_pool).await;
    });

    Ok(path_str)
}

#[tauri::command]
async fn pull_and_purge(
    api_url: String,
) -> Result<PullResult, String> {
    let export_url = format!("{}/api/local-db/export", api_url.trim_end_matches('/'));
    let purge_url = format!("{}/api/local-db/purge", api_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let res = client
        .get(&export_url)
        .send()
        .await
        .map_err(|e| format!("Erreur lors de l'export: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Export API status error: {}", res.status()));
    }

    let payload: ExportPayload = res
        .json()
        .await
        .map_err(|e| format!("Erreur de désérialisation JSON export: {}", e))?;

    let path_str = get_db_path()?.to_string_lossy().to_string();
    let pool = init_pool(&path_str).await?;

    let mut result = process_payload(pool, &payload).await;

    let bg_pool = result.bg_pool.clone();
    tauri::async_runtime::spawn(async move {
        run_background_chroma_indexer(bg_pool).await;
    });

    let purge_res = client.post(&purge_url).send().await;
    let purged = match purge_res {
        Ok(resp) => resp.status().is_success(),
        Err(e) => {
            result.errors.push(format!("Avertissement purge web: {}", e));
            false
        }
    };

    Ok(PullResult {
        pulled: result.pulled,
        failed: result.failed,
        errors: result.errors,
        purged,
    })
}

struct ProcessResult {
    pulled: HashMap<String, usize>,
    failed: usize,
    errors: Vec<String>,
    bg_pool: Pool<Sqlite>,
}

fn json_str(val: &serde_json::Value, default: &str) -> String {
    val.as_str().unwrap_or(default).to_string()
}

fn json_str_opt(val: &serde_json::Value) -> Option<String> {
    val.as_str().map(|s| s.to_string())
}

fn json_num(val: &serde_json::Value, default: i64) -> i64 {
    val.as_i64().unwrap_or(default)
}

fn json_bool(val: &serde_json::Value) -> i32 {
    if val.as_bool().unwrap_or(false) { 1 } else { 0 }
}

fn json_array_str(val: &serde_json::Value) -> String {
    if val.is_null() {
        "[]".to_string()
    } else if val.is_string() {
        val.as_str().unwrap_or("[]").to_string()
    } else {
        serde_json::to_string(val).unwrap_or_else(|_| "[]".to_string())
    }
}

fn json_obj_str(val: &serde_json::Value) -> String {
    if val.is_null() {
        "{}".to_string()
    } else if val.is_string() {
        val.as_str().unwrap_or("{}").to_string()
    } else {
        serde_json::to_string(val).unwrap_or_else(|_| "{}".to_string())
    }
}

async fn process_payload(pool: Pool<Sqlite>, payload: &ExportPayload) -> ProcessResult {
    let mut pulled: HashMap<String, usize> = HashMap::new();
    let failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    let tables = &payload.tables;

    for procedure in tables.get("procedures").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(procedure, ""))
        .bind(json_str(&procedure["code"], ""))
        .bind(json_str(&procedure["title"], ""))
        .bind(json_str_opt(&procedure["description"]))
        .bind(json_str(&procedure["category"], ""))
        .bind(json_str(&procedure["priority"], "moyenne"))
        .bind(json_str_opt(&procedure["location_type"]))
        .bind(json_str_opt(&procedure["location_path"]))
        .bind(json_str_opt(&procedure["bloc_code"]))
        .bind(json_str_opt(&procedure["equipement_code"]))
        .bind(json_obj_str(&procedure["metadata_json"]))
        .bind(json_str(&procedure["created_at"], ""))
        .bind(json_str(&procedure["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("procedures".into(), pulled.get("procedures").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("procedure {}: {}", procedure["code"].as_str().unwrap_or("?"), e)); }
        }
    }

    for step in tables.get("procedureSteps").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(step, ""))
        .bind(json_str(&step["procedure_id"], ""))
        .bind(json_num(&step["step_order"], 0))
        .bind(json_str(&step["step_id"], ""))
        .bind(json_str(&step["title"], ""))
        .bind(json_str_opt(&step["subtitle"]))
        .bind(json_str(&step["instructions"], ""))
        .bind(json_str(&step["step_type"], "consigne_simple"))
        .bind(json_bool(&step["is_mandatory"]))
        .bind(json_array_str(&step["dependencies"]))
        .bind(json_obj_str(&step["media_requirements"]))
        .bind(json_obj_str(&step["alarms"]))
        .bind(json_array_str(&step["alarm_codes"]))
        .bind(json_array_str(&step["attachments"]))
        .bind(json_bool(&step["timer_enabled"]))
        .bind(json_num(&step["timer_seconds"], 0))
        .bind(json_str(&step["created_at"], ""))
        .bind(json_str(&step["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("procedureSteps".into(), pulled.get("procedureSteps").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("procedure_step {}: {}", step["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for alarm in tables.get("alarms").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(alarm, ""))
        .bind(json_str(&alarm["code"], ""))
        .bind(json_str(&alarm["bloc_code"], ""))
        .bind(json_str(&alarm["equipement_code"], ""))
        .bind(json_str(&alarm["location_type"], ""))
        .bind(json_str(&alarm["location_path"], ""))
        .bind(json_str_opt(&alarm["groupe_path"]))
        .bind(json_str(&alarm["type"], ""))
        .bind(json_str(&alarm["severity"], ""))
        .bind(json_str(&alarm["description"], ""))
        .bind(json_str_opt(&alarm["condition"]))
        .bind(json_obj_str(&alarm["remedy"]))
        .bind(json_str(&alarm["status"], "ACTIVE"))
        .bind(json_str_opt(&alarm["triggered_at"]))
        .bind(json_str_opt(&alarm["resolved_at"]))
        .bind(json_obj_str(&alarm["metadata"]))
        .bind(json_str(&alarm["created_at"], ""))
        .bind(json_str(&alarm["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("alarms".into(), pulled.get("alarms").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("alarm {}: {}", alarm["code"].as_str().unwrap_or("?"), e)); }
        }
    }

    for event in tables.get("alarmEvents").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
            INSERT INTO alarm_events (id, alarm_id, event_type, occurred_at, operator_id, comment, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              alarm_id = excluded.alarm_id,
              event_type = excluded.event_type,
              occurred_at = excluded.occurred_at,
              operator_id = excluded.operator_id,
              comment = excluded.comment,
              metadata = excluded.metadata
            "#
        )
        .bind(json_str(event, ""))
        .bind(json_str(&event["alarm_id"], ""))
        .bind(json_str(&event["event_type"], ""))
        .bind(json_str(&event["occurred_at"], ""))
        .bind(json_str_opt(&event["operator_id"]))
        .bind(json_str_opt(&event["comment"]))
        .bind(json_obj_str(&event["metadata"]))
        .execute(&pool)
        .await
        {
            Ok(_) => {}
            Err(e) => { errors.push(format!("alarm_event {}: {}", event["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for media in tables.get("mediaItems").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(media, ""))
        .bind(json_str(&media["title"], ""))
        .bind(json_str(&media["category"], ""))
        .bind(json_str(&media["description"], ""))
        .bind(json_array_str(&media["tags"]))
        .bind(json_str(&media["kind"], "image"))
        .bind(json_str(&media["mime_type"], ""))
        .bind(json_num(&media["size"], 0))
        .bind(json_str(&media["data_url"], ""))
        .bind(json_str_opt(&media["thumbnail_url"]))
        .bind(json_str_opt(&media["location_type"]))
        .bind(json_str_opt(&media["location_path"]))
        .bind(json_str_opt(&media["bloc_code"]))
        .bind(json_str_opt(&media["equipement_code"]))
        .bind(json_str(&media["created_at"], ""))
        .bind(json_str(&media["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("mediaItems".into(), pulled.get("mediaItems").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("media {}: {}", media["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for item in tables.get("knowledgeItems").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(item, ""))
        .bind(json_str(&item["user_id"], ""))
        .bind(json_str(&item["type"], ""))
        .bind(json_str(&item["title"], ""))
        .bind(json_str_opt(&item["question"]))
        .bind(json_str_opt(&item["answer"]))
        .bind(json_array_str(&item["tags"]))
        .bind(json_str_opt(&item["category"]))
        .bind(json_str_opt(&item["content"]))
        .bind(json_bool(&item["synced"]))
        .bind(json_bool(&item["vectorized"]))
        .bind(json_str(&item["created_at"], ""))
        .bind(json_str(&item["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("knowledgeItems".into(), pulled.get("knowledgeItems").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("knowledge {}: {}", item["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for node in tables.get("locationNodes").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
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
            "#
        )
        .bind(json_str(node, ""))
        .bind(json_str(&node["location_type"], ""))
        .bind(json_str(&node["path"], ""))
        .bind(json_str_opt(&node["bloc_code"]))
        .bind(json_str_opt(&node["equipement_code"]))
        .bind(json_str_opt(&node["groupe_code"]))
        .bind(json_str_opt(&node["libelle"]))
        .bind(json_str_opt(&node["parent_path"]))
        .bind(json_num(&node["level"], 0))
        .bind(json_obj_str(&node["metadata"]))
        .bind(json_str(&node["created_at"], ""))
        .bind(json_str(&node["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => { pulled.insert("locationNodes".into(), pulled.get("locationNodes").unwrap_or(&0) + 1); }
            Err(e) => { errors.push(format!("location_node {}: {}", node["path"].as_str().unwrap_or("?"), e)); }
        }
    }

    for assignment in tables.get("dataAssignments").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
            INSERT INTO data_assignments (id, entity_type, entity_id, location_type, location_path, file_path, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              entity_type = excluded.entity_type,
              entity_id = excluded.entity_id,
              location_type = excluded.location_type,
              location_path = excluded.location_path,
              file_path = excluded.file_path,
              updated_at = excluded.updated_at
            "#
        )
        .bind(json_str(assignment, ""))
        .bind(json_str(&assignment["entity_type"], ""))
        .bind(json_str(&assignment["entity_id"], ""))
        .bind(json_str(&assignment["location_type"], ""))
        .bind(json_str(&assignment["location_path"], ""))
        .bind(json_str_opt(&assignment["file_path"]))
        .bind(json_str(&assignment["created_at"], ""))
        .bind(json_str(&assignment["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => {}
            Err(e) => { errors.push(format!("data_assignment {}: {}", assignment["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for rule in tables.get("guardrailRules").unwrap_or(&vec![]) {
        match sqlx::query(
            r#"
            INSERT INTO guardrail_rules (id, section, rule, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              section = excluded.section,
              rule = excluded.rule,
              is_active = excluded.is_active,
              updated_at = excluded.updated_at
            "#
        )
        .bind(json_str(rule, ""))
        .bind(json_str(&rule["section"], "general"))
        .bind(json_str(&rule["rule"], ""))
        .bind(json_bool(&rule["is_active"]))
        .bind(json_str(&rule["created_at"], ""))
        .bind(json_str(&rule["updated_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => {}
            Err(e) => { errors.push(format!("guardrail {}: {}", rule["id"].as_str().unwrap_or("?"), e)); }
        }
    }

    for chroma in tables.get("chromaIndex").unwrap_or(&vec![]) {
        let embedding = if chroma["embedding"].is_null() {
            "[]".to_string()
        } else if chroma["embedding"].is_string() {
            chroma["embedding"].as_str().unwrap_or("[]").to_string()
        } else {
            serde_json::to_string(&chroma["embedding"]).unwrap_or_else(|_| "[]".to_string())
        };

        match sqlx::query(
            r#"
            INSERT INTO chroma_index (id, collection, document_id, content, metadata_json, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(document_id) DO UPDATE SET
              collection = excluded.collection,
              content = excluded.content,
              metadata_json = excluded.metadata_json,
              embedding = excluded.embedding,
              created_at = excluded.created_at
            "#
        )
        .bind(json_str(chroma, ""))
        .bind(json_str(&chroma["collection"], "default"))
        .bind(json_str(&chroma["document_id"], ""))
        .bind(json_str(&chroma["content"], ""))
        .bind(json_obj_str(&chroma["metadata_json"]))
        .bind(embedding)
        .bind(json_str(&chroma["created_at"], ""))
        .execute(&pool)
        .await
        {
            Ok(_) => {}
            Err(e) => { errors.push(format!("chroma {}: {}", chroma["document_id"].as_str().unwrap_or("?"), e)); }
        }
    }

    ProcessResult {
        pulled,
        failed,
        errors,
        bg_pool: pool,
    }
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_local_db_path,
            get_local_db_info,
            initialize_database,
            pull_and_purge
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors de l'exécution de l'application tauri");
}
