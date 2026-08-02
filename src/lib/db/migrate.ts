import fs from "fs";
import path from "path";
import { getPool } from "../db";

const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "db", "schema.sql");

export async function runMigrations(): Promise<void> {
  const sql = fs.readFileSync(SCHEMA_PATH, "utf-8");

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("✅ Migrations appliquées avec succès");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erreur lors des migrations:", error);
    throw error;
  } finally {
    client.release();
  }
}
