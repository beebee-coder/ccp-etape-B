import fs from "fs";
import path from "path";
import { getPool, provider } from "../db";

import dotenv from "dotenv";
dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SCHEMA_DIR = path.join(process.cwd(), "src", "lib", "db");

function getSchemaPath(): string {
  const schemaFile = provider === "sqlite" ? "schema-sqlite.sql" : "schema.sql";
  return path.join(SCHEMA_DIR, schemaFile);
}

async function migrateSqlite(): Promise<void> {
  const client = await getPool().connect();
  try {
    const schemaPath = getSchemaPath();
    const sql = fs.readFileSync(schemaPath, "utf-8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await client.query(stmt);
    }

    const hasColumn = async (table: string, column: string): Promise<boolean> => {
      const result = await client.query<{ name: string }>(
        `PRAGMA table_info(${table})`
      );
      return result.rows.some((row) => row.name === column);
    };

    if (!(await hasColumn("knowledge_items", "location_type"))) {
      await client.query(`ALTER TABLE knowledge_items ADD COLUMN location_type VARCHAR(20) CHECK (location_type IN ('centrale','groupe','global'))`);
    }
    if (!(await hasColumn("knowledge_items", "location_path"))) {
      await client.query(`ALTER TABLE knowledge_items ADD COLUMN location_path VARCHAR(200)`);
    }
    if (!(await hasColumn("knowledge_items", "bloc_code"))) {
      await client.query(`ALTER TABLE knowledge_items ADD COLUMN bloc_code VARCHAR(10)`);
    }
    if (!(await hasColumn("knowledge_items", "equipement_code"))) {
      await client.query(`ALTER TABLE knowledge_items ADD COLUMN equipement_code VARCHAR(50)`);
    }

    const hasIndex = async (indexName: string): Promise<boolean> => {
      const result = await client.query<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='index' AND name=$1`,
        [indexName]
      );
      return result.rows.length > 0;
    };

    if (!(await hasIndex("idx_knowledge_location"))) {
      await client.query(`CREATE INDEX idx_knowledge_location ON knowledge_items(location_type, location_path)`);
    }
    if (!(await hasIndex("idx_knowledge_bloc"))) {
      await client.query(`CREATE INDEX idx_knowledge_bloc ON knowledge_items(bloc_code)`);
    }

    console.log("✅ Migrations SQLite appliquées avec succès");
  } catch (error) {
    console.error("❌ Erreur lors des migrations SQLite:", error);
    throw error;
  } finally {
    client.release();
  }
}

async function migratePostgres(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const schemaPath = getSchemaPath();
    const sql = fs.readFileSync(schemaPath, "utf-8");

    await client.query("BEGIN");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query(sql);

    await client.query(`ALTER TABLE knowledge_items DROP CONSTRAINT IF EXISTS knowledge_items_user_id_fkey`);

    await client.query(`ALTER TABLE q_r_uploads ALTER COLUMN id TYPE TEXT USING id::TEXT`);
    await client.query(`ALTER TABLE q_r_uploads ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT`);
    await client.query(`ALTER TABLE knowledge_items ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT`);

    await client.query(`ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) CHECK (location_type IN ('centrale','groupe','global'))`);
    await client.query(`ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS location_path VARCHAR(200)`);
    await client.query(`ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS bloc_code VARCHAR(10)`);
    await client.query(`ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS equipement_code VARCHAR(50)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_location ON knowledge_items(location_type, location_path)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_knowledge_bloc ON knowledge_items(bloc_code)`);

    await client.query("COMMIT");
    console.log("✅ Migrations PostgreSQL appliquées avec succès");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erreur lors des migrations PostgreSQL:", error);
    throw error;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  if (provider === "sqlite") {
    await migrateSqlite();
    return;
  }
  await migratePostgres();
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
