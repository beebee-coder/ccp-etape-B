-- ============================================================
-- NexaFlow — Schéma PostgreSQL de production
-- Tables effectivement utilisées + tables aspirational
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. UTILISATEURS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(100),
  role            VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================
-- 2. PROCÉDURES (actuel — server-store.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS procedures (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                VARCHAR(100) NOT NULL UNIQUE,
  title               VARCHAR(255) NOT NULL,
  description         TEXT,
  category            VARCHAR(100) NOT NULL,
  priority            VARCHAR(20) NOT NULL DEFAULT 'moyenne',
  estimated_time_min  INTEGER NOT NULL DEFAULT 30,
  required_roles      TEXT[] NOT NULL DEFAULT '{}',
  global_safety_instructions TEXT[] NOT NULL DEFAULT '{}',
  metadata_json       JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procedures_code ON procedures(code);
CREATE INDEX IF NOT EXISTS idx_procedures_category ON procedures(category);

-- Étapes d'une procédure (normalisé depuis le JSON imbriqué)
CREATE TABLE IF NOT EXISTS procedure_steps (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  procedure_id      UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  step_order        INTEGER NOT NULL,
  step_id           VARCHAR(100) NOT NULL,
  title             VARCHAR(255) NOT NULL,
  subtitle          TEXT,
  instructions      TEXT NOT NULL,
  step_type         VARCHAR(50) NOT NULL DEFAULT 'consigne_simple',
  is_mandatory      BOOLEAN NOT NULL DEFAULT false,
  dependencies      TEXT[] NOT NULL DEFAULT '{}',
  media_requirements JSONB NOT NULL DEFAULT '[]',
  alarms            JSONB NOT NULL DEFAULT '[]',
  attachments       TEXT[] NOT NULL DEFAULT '{}',
  timer_enabled     BOOLEAN NOT NULL DEFAULT false,
  timer_seconds     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP,
  UNIQUE(procedure_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_procedure_steps_procedure ON procedure_steps(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_steps_order ON procedure_steps(procedure_id, step_order);

-- ============================================================
-- 3. ÉTAT DES LIEUX (actuel — server-store.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS etat_des_lieux_reports (
  id              VARCHAR(100) PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NOT NULL,
  location        VARCHAR(255) NOT NULL,
  attachments     JSONB NOT NULL DEFAULT '[]',
  status          VARCHAR(20) NOT NULL DEFAULT 'draft',
  author_name     VARCHAR(100) NOT NULL,
  author_role     VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edl_status ON etat_des_lieux_reports(status);
CREATE INDEX IF NOT EXISTS idx_edl_author ON etat_des_lieux_reports(author_role);

-- ============================================================
-- 4. MÉDIAS / IMAGES (actuel — server-store.ts)
-- ============================================================
CREATE TABLE IF NOT EXISTS media_items (
  id              VARCHAR(100) PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  category        VARCHAR(100) NOT NULL,
  description     TEXT DEFAULT '',
  tags            TEXT[] NOT NULL DEFAULT '{}',
  kind            VARCHAR(20) NOT NULL DEFAULT 'image',
  mime_type       VARCHAR(100) NOT NULL,
  size            INTEGER NOT NULL,
  data_url        TEXT NOT NULL,
  thumbnail_url   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_category ON media_items(category);
CREATE INDEX IF NOT EXISTS idx_media_kind ON media_items(kind);

-- ============================================================
-- 5. WORKFLOWS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflows (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(150) NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'draft',
  trigger_type  VARCHAR(50),
  config        JSONB DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

-- ============================================================
-- 6. WORKFLOW_STEPS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_steps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id   UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  action_type   VARCHAR(50) NOT NULL,
  config        JSONB DEFAULT '{}',
  next_step_id  UUID REFERENCES workflow_steps(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON workflow_steps(workflow_id);

-- ============================================================
-- 7. EXÉCUTIONS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS executions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step_id UUID,
  status          VARCHAR(50) NOT NULL DEFAULT 'running',
  started_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMP,
  error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

-- ============================================================
-- 8. INTÉGRATIONS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service       VARCHAR(50) NOT NULL,
  credentials   JSONB DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_user ON integrations(user_id);

-- ============================================================
-- 9. AUDIT_LOGS (aspirational — structure-bdd)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- ============================================================
-- 10. CHROMA INDEX (vecteur / RAG)
-- ============================================================
CREATE TABLE IF NOT EXISTS chroma_index (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection    VARCHAR(100) NOT NULL,
  document_id   VARCHAR(100) NOT NULL,
  content       TEXT NOT NULL,
  metadata_json JSONB DEFAULT '{}',
  embedding     vector(384),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chroma_collection ON chroma_index(collection);
CREATE INDEX IF NOT EXISTS idx_chroma_document ON chroma_index(document_id);

-- ============================================================
-- 11. GARDE-FOUS IA (guardrails)
-- ============================================================
CREATE TABLE IF NOT EXISTS guardrail_rules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section       VARCHAR(50) NOT NULL DEFAULT 'general',
  rule          TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guardrail_section ON guardrail_rules(section);
CREATE INDEX IF NOT EXISTS idx_guardrail_active ON guardrail_rules(is_active);
