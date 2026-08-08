import Database, { Database as SqliteDatabase } from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { DbAdapter, DbClient, DbPool } from "./types";

export function isSqliteMode(): boolean {
  return (process.env.DATA_PROVIDER || "neon") === "sqlite";
}

export function getSqlitePath(): string {
  let p = process.env.SQLITE_DB_PATH || "./.local-db/visionode.sqlite";
  if (!path.isAbsolute(p)) {
    p = path.resolve(process.cwd(), p);
  }
  return p;
}

function findMatchingParen(sql: string, openParenIndex: number): number {
  let depth = 1;
  let i = openParenIndex + 1;
  while (i < sql.length && depth > 0) {
    if (sql[i] === "(") depth++;
    else if (sql[i] === ")") depth--;
    if (depth === 0) return i;
    i++;
  }
  return -1;
}

function translateJsonAgg(sql: string): string {
  const regex = /JSON_AGG\s*\(/gi;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql)) !== null) {
    result += sql.slice(lastIndex, match.index);

    const openParenIndex = match.index + match[0].length - 1;
    const closeParenIndex = findMatchingParen(sql, openParenIndex);

    if (closeParenIndex === -1) {
      result += "json_group_array(";
      lastIndex = match.index + match[0].length;
      continue;
    }

    let content = sql.slice(openParenIndex + 1, closeParenIndex);
    content = content.replace(/\s+ORDER\s+BY\s+[^(]+(?=\))/gi, "");

    result += `json_group_array(${content})`;
    lastIndex = closeParenIndex + 1;
    regex.lastIndex = closeParenIndex + 1;
  }

  result += sql.slice(lastIndex);
  return result;
}

function translateSql(sql: string): string {
  let translated = sql;

  translated = translated.replace(/::json([bB]?)/g, "");

  translated = translated.replace(/\bJSON_BUILD_OBJECT\b/gi, "json_object");

  translated = translateJsonAgg(translated);

  translated = translated.replace(/\bTRUE\b/gi, "1");
  translated = translated.replace(/\bFALSE\b/gi, "0");

  return translated;
}

function convertParamsForSqlite(
  params: unknown[] | undefined,
): Record<string, unknown> | unknown[] {
  if (!params) return [];
  const result: Record<string, unknown> = {};
  params.forEach((value, i) => {
    const key = String(i + 1);
    if (Array.isArray(value)) {
      result[key] = JSON.stringify(value);
    } else if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === "boolean") {
      result[key] = value ? 1 : 0;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else {
      result[key] = value;
    }
  });
  return result;
}

const BOOLEAN_KEYS: Set<string> = new Set([
  "is_mandatory",
  "isMandatory",
  "timer_enabled",
  "timerEnabled",
  "is_active",
  "isActive",
  "is_approved",
  "isApproved",
  "approved",
  "required",
  "is_active",
]);

function isBooleanKey(key: string): boolean {
  return BOOLEAN_KEYS.has(key);
}

function normalizeBooleans(value: unknown, key?: string): unknown {
  if (
    key !== undefined &&
    typeof value === "number" &&
    (value === 0 || value === 1) &&
    isBooleanKey(key)
  ) {
    return value === 1;
  }
  if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      return value.map((v) => normalizeBooleans(v, undefined));
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = normalizeBooleans(v, k);
    }
    return result;
  }
  return value;
}

function tryParseJson(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith("[") || value.startsWith("{")) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
  }
  return value;
}

function processRow(
  row: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!row) return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    let processed = tryParseJson(value);
    processed = normalizeBooleans(processed, key);
    result[key] = processed;
  }
  return result;
}

function executeQuery(
  db: SqliteDatabase,
  sql: string,
  params?: unknown[],
): { rows: unknown[]; rowCount: number } {
  const translatedSql = translateSql(sql);
  const sqliteParams = convertParamsForSqlite(params);

  const stmt = db.prepare(translatedSql);

  const isSelect = /^\s*(SELECT|PRAGMA)/i.test(translatedSql);
  const hasReturning = /RETURNING/i.test(translatedSql);

  if (isSelect || hasReturning) {
    const rows = stmt.all(sqliteParams as Record<string, unknown>);
    const processedRows = rows
      .map((row) => processRow(row as Record<string, unknown>))
      .filter((row): row is Record<string, unknown> => row !== null);
    return { rows: processedRows, rowCount: processedRows.length };
  } else {
    const info = stmt.run(sqliteParams as Record<string, unknown>);
    return { rows: [], rowCount: info.changes };
  }
}

export class SqliteClient implements DbClient {
  constructor(private db: SqliteDatabase) {}

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const { rows, rowCount } = executeQuery(this.db, text, params);
    return { rows: rows as T[], rowCount };
  }

  release(): void {}
}

export class SqlitePool implements DbPool {
  constructor(private db: SqliteDatabase) {}

  async connect(): Promise<DbClient> {
    return new SqliteClient(this.db);
  }

  async end(): Promise<void> {
    this.db.close();
  }
}

export class SqliteAdapter implements DbAdapter {
  private db: SqliteDatabase | null = null;

  private getDb(): SqliteDatabase {
    if (!this.db) {
      const dbPath = getSqlitePath();
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.db = new Database(dbPath);

      this.db.function("uuid_generate_v4", () => {
        const bytes = new Uint8Array(16);
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
          const uuid = crypto.randomUUID();
          return uuid.replace(/-/g, "").toLowerCase();
        }
        for (let i = 0; i < 16; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        return Array.from(bytes, (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      });

      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");

      this.db.function("now", () => {
        return new Date().toISOString().slice(0, 19).replace("T", " ");
      });
    }
    return this.db;
  }

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const { rows, rowCount } = executeQuery(this.getDb(), text, params);
    return { rows: rows as T[], rowCount };
  }

  getPool(): DbPool {
    return new SqlitePool(this.getDb());
  }

  async getClient(): Promise<DbClient> {
    return new SqliteClient(this.getDb());
  }

  async closePool(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.query("SELECT 1 as ok");
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}
