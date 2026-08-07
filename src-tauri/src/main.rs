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
    CREATE TABLE IF NOT EXISTS local_meta (
        path TEXT PRIMARY KEY,
        libelle TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id TEXT,
        sync_state TEXT DEFAULT 'SYNCED',
        last_sync_at DATETIME,
        description TEXT,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_manifest (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS knowledge_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT,
        tags TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chroma_index (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL DEFAULT 'default',
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata_json TEXT DEFAULT '{}',
        embedding TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
    CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

    CREATE TABLE IF NOT EXISTS alarms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        severity TEXT DEFAULT 'MEDIUM',
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alarm_events (
        id TEXT PRIMARY KEY,
        alarm_id TEXT NOT NULL,
        status TEXT NOT NULL,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        details TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS location_nodes (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parent_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS data_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS procedures (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        priority TEXT DEFAULT 'MEDIUM',
        location_type TEXT,
        location_path TEXT,
        bloc_code TEXT,
        equipement_code TEXT,
        metadata_json TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS procedure_steps (
        id TEXT PRIMARY KEY,
        procedure_id TEXT NOT NULL,
        step_order INTEGER NOT NULL,
        step_id TEXT,
        title TEXT NOT NULL,
        subtitle TEXT,
        instructions TEXT,
        step_type TEXT DEFAULT 'ACTION',
        is_mandatory INTEGER DEFAULT 1,
        dependencies TEXT DEFAULT '[]',
        media_requirements TEXT DEFAULT '[]',
        alarms TEXT DEFAULT '[]',
        alarm_codes TEXT DEFAULT '[]',
        attachments TEXT DEFAULT '[]',
        timer_enabled INTEGER DEFAULT 0,
        timer_seconds INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guardrail_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        conditions TEXT NOT NULL,
        action TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media_items (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

    let mut pulled: HashMap<String, usize> = HashMap::new();
    let failed = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for (table_name, rows) in payload.tables {
        let count = rows.len();
        pulled.insert(table_name, count);
    }

    let bg_pool = pool.clone();
    tauri::async_runtime::spawn(async move {
        run_background_chroma_indexer(bg_pool).await;
    });

    let purge_res = client.post(&purge_url).send().await;
    let purged = match purge_res {
        Ok(resp) => resp.status().is_success(),
        Err(e) => {
            errors.push(format!("Avertissement purge web: {}", e));
            false
        }
    };

    Ok(PullResult {
        pulled,
        failed,
        errors,
        purged,
    })
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_local_db_path,
            get_local_db_info,
            initialize_database,
            pull_and_purge
        ])
        .run(tauri::generate_context!())
        .expect("erreur lors de l'exécution de l'application tauri");
}
