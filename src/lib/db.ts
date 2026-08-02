import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not defined in environment variables");
    }
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 100;

const TRANSIENT_ERROR_CODES = new Set([
  "08006",
  "08001",
  "57P03",
  "40001",
  "55P03",
  "53300",
  "55P02",
]);

function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string };
  if (err.code) {
    if (err.code.startsWith("E")) return true;
    if (TRANSIENT_ERROR_CODES.has(err.code)) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function query<T extends QueryResultRow = object>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const result = await client.query(text, params);
      return result as QueryResult<T>;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isTransientError(error)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      } else {
        throw error;
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }
  throw lastError;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function checkConnection(): Promise<boolean> {
  try {
    const result = await query("SELECT NOW() as now");
    return result.rows.length > 0;
  } catch {
    return false;
  }
}
