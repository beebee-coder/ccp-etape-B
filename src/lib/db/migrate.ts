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

export async function runMigrations(): Promise<void> {
  const schemaPath = getSchemaPath();
  const sql = fs.readFileSync(schemaPath, "utf-8");

  if (provider === "sqlite") {
    const client = await getPool().connect();
    try {
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      console.log("✅ Migrations SQLite appliquées avec succès");
    } catch (error) {
      console.error("❌ Erreur lors des migrations SQLite:", error);
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
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

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
