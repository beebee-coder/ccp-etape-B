import { Pool, type PoolClient } from "pg";
import type { DbAdapter, DbClient, DbPool } from "./types";

export class PgClient implements DbClient {
  constructor(private client: PoolClient) {}

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const result = await this.client.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  release(): void {
    this.client.release();
  }
}

export class PgPool implements DbPool {
  constructor(private pool: Pool) {}

  async connect(): Promise<DbClient> {
    const client = await this.pool.connect();
    return new PgClient(client);
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}

export class PgAdapter implements DbAdapter {
  private pool: Pool | null = null;

  private ensurePool(): Pool {
    if (!this.pool) {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error("DATABASE_URL is not defined in environment variables");
      }
      this.pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    return this.pool;
  }

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const pool = this.ensurePool();
    let lastError: unknown;

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

    const isTransientError = (error: unknown): boolean => {
      if (!error || typeof error !== "object") return false;
      const err = error as { code?: string };
      if (err.code) {
        if (err.code.startsWith("E")) return true;
        if (TRANSIENT_ERROR_CODES.has(err.code)) return true;
      }
      return false;
    };

    const sleep = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let client: PoolClient | undefined;
      try {
        client = await pool.connect();
        const result = await client.query(text, params);
        return {
          rows: result.rows as T[],
          rowCount: result.rowCount ?? 0,
        };
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

  getPool(): DbPool {
    return new PgPool(this.ensurePool());
  }

  async getClient(): Promise<DbClient> {
    const client = await this.ensurePool().connect();
    return new PgClient(client);
  }

  async closePool(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.query("SELECT NOW() as now");
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }
}
