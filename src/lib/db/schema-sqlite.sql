-- ============================================================
-- Visionode — Schéma SQLite pour le client desktop (Tauri)
-- Version adaptée du schema.sql (PostgreSQL) pour SQLite
-- ============================================================

-- SQLite gère UUID via fonction personnalisée uuid_generate_v4() (enregistrée par l'adaptateur)
-- Les colonnes TEXT[] sont stockées comme TEXT (JSON) — compatibles avec SQLite
-- Les colonnes JSONB sont stockées comme TEXT
-- NOW() dans les requêtes est traduite par l'adaptateur en datetime('now')

-- ============================================================
-- 1. UTILISATEURS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100),
  role            VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- 2. PROCÉDURES
-- ============================================================
CREATE TABLE IF NOT EXISTS procedures (
  id                  TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  code                VARCHAR(100) NOT NULL UNIQUE,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  category            VARCHAR(100) NOT NULL,
  priority            VARCHAR(20) NOT NULL DEFAULT 'moyenne',
  estimated_time_min  INTEGER NOT NULL DEFAULT 30,
  required_roles      TEXT NOT NULL DEFAULT '[]',
  global_safety_instructions TEXT NOT NULL DEFAULT '[]',
  metadata_json       TEXT NOT NULL DEFAULT '{}',
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedures_code ON procedures(code);
CREATE INDEX IF NOT EXISTS idx_procedures_category ON procedures(category);

-- Étapes d'une procédure
CREATE TABLE IF NOT EXISTS procedure_steps (
  id                TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  procedure_id      TEXT NOT NULL,
  step_order        INTEGER NOT NULL,
  step_id           VARCHAR(100) NOT NULL,
  title             VARCHAR(255) NOT NULL,
  subtitle          TEXT,
  instructions      TEXT NOT NULL,
  step_type         VARCHAR(50) NOT NULL DEFAULT 'consigne_simple',
  is_mandatory      BOOLEAN NOT NULL DEFAULT false,
  dependencies      TEXT NOT NULL DEFAULT '[]',
  media_requirements TEXT NOT NULL DEFAULT '[]',
  alarms            TEXT NOT NULL DEFAULT '[]',
  attachments       TEXT NOT NULL DEFAULT '[]',
  timer_enabled     BOOLEAN NOT NULL DEFAULT false,
  timer_seconds     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedure_steps_procedure ON procedure_steps(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_steps_order ON procedure_steps(procedure_id, step_order);

-- ============================================================
-- 3. EXÉCUTIONS DE PROCÉDURES
-- ============================================================
CREATE TABLE IF NOT EXISTS procedure_executions (
  id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  procedure_id    TEXT NOT NULL,
  procedure_code  VARCHAR(100) NOT NULL,
  operator_id     TEXT NOT NULL,
  start_time      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time        TIMESTAMP,
  status          VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  steps_status    TEXT NOT NULL DEFAULT '[]',
  total_duration  INTEGER DEFAULT 0,
  current_step    INTEGER,
  alarms          TEXT DEFAULT '[]',
  fallbacks       TEXT DEFAULT '[]',
  events          TEXT DEFAULT '[]',
  signature       TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedure_executions_procedure ON procedure_executions(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_executions_operator ON procedure_executions(operator_id);
CREATE INDEX IF NOT EXISTS idx_procedure_executions_status ON procedure_executions(status);
CREATE INDEX IF NOT EXISTS idx_procedure_executions_created ON procedure_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_procedure_executions_procedure_code ON procedure_executions(procedure_code);

-- ============================================================
-- 4. ÉTAT DES LIEUX
-- ============================================================
CREATE TABLE IF NOT EXISTS etat_des_lieux_reports (
  id              VARCHAR(100) PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  location        VARCHAR(255) NOT NULL,
  attachments     TEXT NOT NULL DEFAULT '[]',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  author_name     VARCHAR(100) NOT NULL,
  author_role     VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edl_status ON etat_des_lieux_reports(status);
CREATE INDEX IF NOT EXISTS idx_edl_author ON etat_des_lieux_reports(author_role);

-- ============================================================
-- 4. MÉDIAS / IMAGES
-- ============================================================
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
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_category ON media_items(category);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media_items(kind);

-- ============================================================
-- 5. WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  user_id       TEXT NOT NULL,
  name          VARCHAR(150) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'draft',
  trigger_type  VARCHAR(50),
  config        TEXT DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- ============================================================
-- 6. WORKFLOW_STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  workflow_id   TEXT NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  action_type   VARCHAR(50) NOT NULL,
  config        TEXT DEFAULT '{}',
  next_step_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);

-- ============================================================
-- 7. EXÉCUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS executions (
  id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  workflow_id     TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  current_step_id TEXT,
  status          VARCHAR(50) NOT NULL DEFAULT 'running',
  started_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at     TIMESTAMP,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

-- ============================================================
-- 8. INTÉGRATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  user_id       TEXT NOT NULL,
  service       VARCHAR(50) NOT NULL,
  credentials   TEXT DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);

-- ============================================================
-- 9. AUDIT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  user_id       TEXT,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   TEXT,
  metadata      TEXT DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- 10. CHROMA INDEX
-- ============================================================
CREATE TABLE IF NOT EXISTS chroma_index (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  collection    VARCHAR(100) NOT NULL,
  document_id   VARCHAR(100) NOT NULL,
  content       TEXT NOT NULL,
  metadata_json TEXT DEFAULT '{}',
  embedding     TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

-- ============================================================
-- 11. GARDE-FOUS IA (guardrails)
-- ============================================================
CREATE TABLE IF NOT EXISTS guardrail_rules (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  section       VARCHAR(50) NOT NULL DEFAULT 'general',
  rule          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guardrail_section ON guardrail_rules(section);
CREATE INDEX IF NOT EXISTS idx_guardrail_active ON guardrail_rules(is_active);

-- ============================================================
-- 12. KNOWLEDGE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_items (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  type      TEXT NOT NULL,
  title     TEXT NOT NULL,
  question  TEXT,
  answer    TEXT,
  tags      TEXT NOT NULL DEFAULT '[]',
  category  TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  content   TEXT
);

CREATE INDEX IF NOT EXISTS idx_knowledge_user ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_knowledge_user_type ON knowledge_items(user_id, type);

-- ============================================================
-- 13. Q/R UPLOADS
-- ============================================================
CREATE TABLE IF NOT EXISTS q_r_uploads (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  file_name TEXT NOT NULL,
  set_name  TEXT NOT NULL,
  version   INTEGER NOT NULL DEFAULT 1,
  directory TEXT NOT NULL,
  file_path TEXT NOT NULL,
  qa_count  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_uploads_user ON q_r_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_uploads_set_name ON q_r_uploads(set_name);

-- ============================================================
-- 14. SYSTÈME EMBARQUÉ / IOT
-- ============================================================
CREATE TABLE IF NOT EXISTS iot_devices (
  id               VARCHAR(100) PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  connection_type  VARCHAR(50) NOT NULL DEFAULT 'wireless',
  connection_status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
  rssi             INTEGER,
  sensors_json     TEXT NOT NULL DEFAULT '{}',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_status ON iot_devices(connection_status);

CREATE TABLE IF NOT EXISTS iot_actuators (
  id          VARCHAR(100) PRIMARY KEY,
  device_id   VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL,
  state       VARCHAR(20) NOT NULL DEFAULT 'idle',
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iot_actuators_device ON iot_actuators(device_id);

CREATE TABLE IF NOT EXISTS iot_sensor_readings (
  id           TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  device_id    VARCHAR(100) NOT NULL,
  reading_json TEXT NOT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_device ON iot_sensor_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_readings_created ON iot_sensor_readings(created_at);

-- ============================================================
-- 15. MESSAGES DE CHAT IA
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id              VARCHAR(100) PRIMARY KEY,
  conversation_id VARCHAR(100) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  role            VARCHAR(20) NOT NULL,
  content         TEXT NOT NULL,
  provider        VARCHAR(50),
  timestamp       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  media           TEXT,
  procedure_id    VARCHAR(100),
  source          VARCHAR(100),
  client_id       VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_messages_procedure ON chat_messages(procedure_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client ON chat_messages(client_id);

-- ============================================================
-- 16. ÉQUIPES
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  color       VARCHAR(50) NOT NULL DEFAULT 'bg-blue-500',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

CREATE TABLE IF NOT EXISTS team_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    INTEGER NOT NULL,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  role       VARCHAR(100) NOT NULL DEFAULT 'user',
  status     VARCHAR(20) NOT NULL DEFAULT 'active',
  avatar     VARCHAR(10),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- ============================================================
-- 17. RAPPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id         TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  date       TEXT NOT NULL,
  points     TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);

-- ============================================================
-- 14. VISIOCONFÉRENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
  id              TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  title           VARCHAR(255) NOT NULL,
  started_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at        TIMESTAMP,
  created_by      VARCHAR(255) NOT NULL,
  participants    TEXT NOT NULL DEFAULT '[]',
  recording_url   VARCHAR(500),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meetings_started ON meetings(started_at);
CREATE INDEX IF NOT EXISTS idx_meetings_ended ON meetings(ended_at);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);

CREATE TABLE IF NOT EXISTS meeting_chat_messages (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  meeting_id    TEXT NOT NULL,
  user_id       VARCHAR(255) NOT NULL,
  user_name     VARCHAR(255) NOT NULL,
  user_initials VARCHAR(10) NOT NULL,
  is_self       BOOLEAN NOT NULL DEFAULT false,
  text          TEXT NOT NULL,
  timestamp     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meeting_chat_meeting ON meeting_chat_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_user ON meeting_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_chat_timestamp ON meeting_chat_messages(timestamp);

-- ============================================================
-- 17. SYSTÈME EMBARQUÉ / IOT (SQLite)
-- ============================================================
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
  id         TEXT PRIMARY KEY,
  device_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,
  state      TEXT NOT NULL DEFAULT 'idle',
  enabled    INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_iot_actuators_device ON iot_actuators(device_id);

CREATE TABLE IF NOT EXISTS iot_sensor_readings (
  id          TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  device_id   TEXT NOT NULL,
  reading_json TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_device ON iot_sensor_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_iot_readings_created ON iot_sensor_readings(created_at);

-- ============================================================
-- 18. LOCAL-FIRST : Métadonnées indexées (.meta.json)
-- ============================================================
CREATE TABLE IF NOT EXISTS local_meta (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  path          TEXT NOT NULL UNIQUE,
  libelle       TEXT NOT NULL,
  code          TEXT NOT NULL,
  type          TEXT NOT NULL,
  parent_id     TEXT,
  sync_state    TEXT NOT NULL DEFAULT 'local-only',
  last_sync_at  TIMESTAMP,
  description   TEXT,
  tags          TEXT NOT NULL DEFAULT '[]',
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_local_meta_path ON local_meta(path);
CREATE INDEX IF NOT EXISTS idx_local_meta_type ON local_meta(type);
CREATE INDEX IF NOT EXISTS idx_local_meta_sync_state ON local_meta(sync_state);
CREATE INDEX IF NOT EXISTS idx_local_meta_parent ON local_meta(parent_id);

-- ============================================================
-- 19. LOCAL-FIRST : File d'attente de synchronisation (web-sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  operation     TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  data          TEXT NOT NULL DEFAULT '{}',
  timestamp     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced', 'failed')),
  retry_count   INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_timestamp ON sync_queue(timestamp);

-- ============================================================
-- 20. LOCAL-FIRST : Manifeste de synchronisation
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_manifest (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  version       TEXT NOT NULL,
  last_sync     TIMESTAMP,
  pending_count INTEGER NOT NULL DEFAULT 0,
  synced_count  INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0
);
