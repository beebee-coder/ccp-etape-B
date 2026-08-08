/**
 * Schéma SQLite pour la base locale du navigateur (SQLite-WASM + OPFS).
 *
 * Ce schéma est l'équivalent de `schema-sqlite.sql` + `LOCAL_FIRST_SCHEMA`
 * mais destiné à être exécuté dans le browser via @sqlite.org/sqlite-wasm.
 *
 * Contraintes :
 *  - Pas d'extensions PostgreSQL (pas de vector, pas de ::jsonb, etc.)
 *  - UUIDs générés via hex(randomblob(16))
 *  - Booléens stockés en INTEGER (0 / 1)
 */

export const BROWSER_DB_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- Méta locales
-- ============================================================
CREATE TABLE IF NOT EXISTS local_meta (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
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

-- ============================================================
-- Procédures
-- ============================================================
CREATE TABLE IF NOT EXISTS procedures (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'maintenance',
  priority        TEXT NOT NULL DEFAULT 'moyenne',
  location_type   TEXT,
  location_path   TEXT,
  bloc_code       TEXT,
  equipement_code TEXT,
  metadata_json   TEXT NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedures_category ON procedures(category);
CREATE INDEX IF NOT EXISTS idx_procedures_location ON procedures(location_type, location_path);

-- ============================================================
-- Étapes de procédures
-- ============================================================
CREATE TABLE IF NOT EXISTS procedure_steps (
  id                  TEXT PRIMARY KEY,
  procedure_id        TEXT NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  step_order          INTEGER NOT NULL,
  step_id             TEXT NOT NULL,
  title               TEXT NOT NULL,
  subtitle            TEXT,
  instructions        TEXT NOT NULL DEFAULT '',
  step_type           TEXT NOT NULL DEFAULT 'standard',
  is_mandatory        INTEGER NOT NULL DEFAULT 1,
  dependencies        TEXT NOT NULL DEFAULT '[]',
  media_requirements  TEXT NOT NULL DEFAULT '{}',
  alarms              TEXT NOT NULL DEFAULT '{}',
  alarm_codes         TEXT NOT NULL DEFAULT '[]',
  attachments         TEXT NOT NULL DEFAULT '[]',
  timer_enabled       INTEGER NOT NULL DEFAULT 0,
  timer_seconds       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(procedure_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_procedure_steps_proc ON procedure_steps(procedure_id);

-- ============================================================
-- Alarmes
-- ============================================================
CREATE TABLE IF NOT EXISTS alarms (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  bloc_code       TEXT NOT NULL,
  equipement_code TEXT NOT NULL,
  location_type   TEXT NOT NULL DEFAULT 'centrale',
  location_path   TEXT NOT NULL,
  groupe_path     TEXT,
  type            TEXT NOT NULL,
  severity        TEXT NOT NULL,
  description     TEXT NOT NULL,
  condition       TEXT,
  remedy          TEXT DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  triggered_at    TIMESTAMP,
  resolved_at     TIMESTAMP,
  metadata        TEXT DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alarms_code ON alarms(code);
CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);
CREATE INDEX IF NOT EXISTS idx_alarms_bloc ON alarms(bloc_code);

-- ============================================================
-- Événements d'alarmes
-- ============================================================
CREATE TABLE IF NOT EXISTS alarm_events (
  id          TEXT PRIMARY KEY,
  alarm_id    TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  operator_id TEXT,
  comment     TEXT,
  metadata    TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alarm_events_alarm ON alarm_events(alarm_id);

-- ============================================================
-- Médias
-- ============================================================
CREATE TABLE IF NOT EXISTS media_items (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  tags            TEXT NOT NULL DEFAULT '[]',
  kind            TEXT NOT NULL,
  mime_type       TEXT,
  size            INTEGER,
  data_url        TEXT,
  thumbnail_url   TEXT,
  location_type   TEXT,
  location_path   TEXT,
  bloc_code       TEXT,
  equipement_code TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_category ON media_items(category);

-- ============================================================
-- Knowledge Items (Q/R)
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_items (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'qa',
  title           TEXT NOT NULL,
  question        TEXT,
  answer          TEXT,
  tags            TEXT NOT NULL DEFAULT '[]',
  category        TEXT,
  location_type   TEXT NOT NULL DEFAULT 'global',
  location_path   TEXT,
  bloc_code       TEXT,
  equipement_code TEXT,
  content         TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  synced          INTEGER NOT NULL DEFAULT 0,
  vectorized      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ki_type ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_ki_synced ON knowledge_items(synced);

-- ============================================================
-- Noeuds de localisation
-- ============================================================
CREATE TABLE IF NOT EXISTS location_nodes (
  id              TEXT PRIMARY KEY,
  location_type   TEXT NOT NULL DEFAULT 'centrale',
  path            TEXT UNIQUE NOT NULL,
  bloc_code       TEXT,
  equipement_code TEXT,
  groupe_code     TEXT,
  libelle         TEXT,
  parent_path     TEXT,
  level           INTEGER NOT NULL DEFAULT 0,
  metadata        TEXT DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_nodes_path ON location_nodes(path);
CREATE INDEX IF NOT EXISTS idx_location_nodes_bloc ON location_nodes(bloc_code);

-- ============================================================
-- Assignation des données
-- ============================================================
CREATE TABLE IF NOT EXISTS data_assignments (
  id            TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location_path TEXT NOT NULL,
  file_path     TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_assignments_entity ON data_assignments(entity_type, entity_id);

-- ============================================================
-- Guardrail Rules
-- ============================================================
CREATE TABLE IF NOT EXISTS guardrail_rules (
  id         TEXT PRIMARY KEY,
  section    TEXT NOT NULL,
  rule       TEXT NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Chroma Index (vecteur / RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS chroma_index (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  collection    TEXT NOT NULL,
  document_id   TEXT NOT NULL UNIQUE,
  content       TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  embedding     TEXT NOT NULL DEFAULT '[]',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

-- ============================================================
-- Sync manifest (état de synchronisation)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_manifest (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  version       TEXT NOT NULL DEFAULT '1.0.0',
  last_sync     TIMESTAMP,
  source        TEXT,
  pending_count INTEGER NOT NULL DEFAULT 0,
  synced_count  INTEGER NOT NULL DEFAULT 0,
  failed_count  INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO sync_manifest (id, version) VALUES (1, '1.0.0');
`;

export const BROWSER_DB_STATEMENTS = BROWSER_DB_SCHEMA
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
