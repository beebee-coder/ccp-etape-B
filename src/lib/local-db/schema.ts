export const LOCAL_FIRST_SCHEMA = `
-- ============================================================
-- Visionode — Tables spécifiques au mode local-first
-- ============================================================

-- Index des métadonnées locales (.meta.json)
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

-- File d'attente de synchronisation (web-sync)
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

-- Manifeste de synchronisation
CREATE TABLE IF NOT EXISTS sync_manifest (
   id            INTEGER PRIMARY KEY CHECK (id = 1),
   version       TEXT NOT NULL,
   last_sync     TIMESTAMP,
   pending_count INTEGER NOT NULL DEFAULT 0,
   synced_count  INTEGER NOT NULL DEFAULT 0,
   failed_count  INTEGER NOT NULL DEFAULT 0
);

-- État du moteur de synchronisation (persistant pour résilience au redémarrage)
CREATE TABLE IF NOT EXISTS sync_engine_state (
   id             INTEGER PRIMARY KEY CHECK (id = 1),
   is_processing  INTEGER NOT NULL DEFAULT 0 CHECK (is_processing IN (0, 1)),
   started_at     TIMESTAMP,
   updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- Knowledge Items (Q/R) — local-first
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_items (
   id          TEXT PRIMARY KEY,
   user_id     TEXT NOT NULL,
   type        TEXT NOT NULL DEFAULT 'qa',
   title       TEXT NOT NULL,
   question    TEXT,
   answer      TEXT,
   tags        TEXT NOT NULL DEFAULT '[]',
   category    TEXT,
   location_type TEXT NOT NULL DEFAULT 'global',
   location_path TEXT,
   bloc_code   TEXT,
   equipement_code TEXT,
   content     TEXT,
   created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   synced      INTEGER NOT NULL DEFAULT 0 CHECK (synced IN (0, 1)),
   vectorized  INTEGER NOT NULL DEFAULT 0 CHECK (vectorized IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_ki_user ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_ki_type ON knowledge_items(type);
CREATE INDEX IF NOT EXISTS idx_ki_synced ON knowledge_items(synced);
CREATE INDEX IF NOT EXISTS idx_ki_vectorized ON knowledge_items(vectorized);
CREATE INDEX IF NOT EXISTS idx_ki_location ON knowledge_items(location_type, location_path);
CREATE INDEX IF NOT EXISTS idx_ki_bloc ON knowledge_items(bloc_code);

-- ============================================================
-- Chroma Index (vecteur / RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS chroma_index (
  id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
  collection    TEXT NOT NULL,
  document_id   TEXT NOT NULL,
  content       TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  embedding     TEXT NOT NULL DEFAULT '[]',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

-- ============================================================
-- 18. ALARMES (local-first)
-- ============================================================
CREATE TABLE IF NOT EXISTS alarms (
   id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
   code          TEXT NOT NULL UNIQUE,
   bloc_code     TEXT NOT NULL,
   equipement_code TEXT NOT NULL,
   location_type TEXT NOT NULL DEFAULT 'centrale',
   location_path TEXT NOT NULL,
   groupe_path   TEXT,
   type          TEXT NOT NULL,
   severity      TEXT NOT NULL,
   description   TEXT NOT NULL,
   condition     TEXT,
   remedy        TEXT DEFAULT '{}',
   status        TEXT NOT NULL DEFAULT 'ACTIVE',
   triggered_at  TIMESTAMP,
   resolved_at   TIMESTAMP,
   metadata      TEXT DEFAULT '{}',
   created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alarms_location ON alarms(location_type, location_path);
CREATE INDEX IF NOT EXISTS idx_alarms_bloc ON alarms(bloc_code);
CREATE INDEX IF NOT EXISTS idx_alarms_code ON alarms(code);
CREATE INDEX IF NOT EXISTS idx_alarms_status ON alarms(status);

CREATE TABLE IF NOT EXISTS alarm_events (
   id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
   alarm_id      TEXT NOT NULL,
   event_type    TEXT NOT NULL,
   occurred_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   operator_id   TEXT,
   comment       TEXT,
   metadata      TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alarm_events_alarm ON alarm_events(alarm_id);
CREATE INDEX IF NOT EXISTS idx_alarm_events_occurred ON alarm_events(occurred_at);

-- ============================================================
-- 19. NOEUDS DE LOCALISATION (referentiel)
-- ============================================================
CREATE TABLE IF NOT EXISTS location_nodes (
   id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
   location_type TEXT NOT NULL DEFAULT 'centrale',
   path          TEXT UNIQUE NOT NULL,
   bloc_code     TEXT,
   equipement_code TEXT,
   groupe_code   TEXT,
   libelle       TEXT,
   parent_path   TEXT,
   level         INTEGER NOT NULL DEFAULT 0,
   metadata      TEXT DEFAULT '{}',
   created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_location_nodes_type ON location_nodes(location_type);
CREATE INDEX IF NOT EXISTS idx_location_nodes_path ON location_nodes(path);
CREATE INDEX IF NOT EXISTS idx_location_nodes_bloc ON location_nodes(bloc_code);

-- ============================================================
-- 20. ASSIGNATION DES DONNEES
-- ============================================================
CREATE TABLE IF NOT EXISTS data_assignments (
   id            TEXT PRIMARY KEY DEFAULT (uuid_generate_v4()),
   entity_type   TEXT NOT NULL,
   entity_id     TEXT NOT NULL,
   location_type TEXT NOT NULL,
   location_path TEXT NOT NULL,
   file_path     TEXT,
   created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
   updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_data_assignments_entity ON data_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_data_assignments_location ON data_assignments(location_type, location_path);
`;
