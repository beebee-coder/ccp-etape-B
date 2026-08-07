import { SqliteAdapter, getSqlitePath } from "./sqlite";
import type { DbAdapter, DbClient, DbPool } from "./types";
import { isTauriEnvironment, tauriGetLocalDbPath } from "@/lib/tauri/commands";

export class TauriSqliteClient implements DbClient {
  constructor(private adapter: SqliteAdapter) {}

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    return this.adapter.query<T>(text, params);
  }

  release(): void {}
}

export class TauriSqlitePool implements DbPool {
  constructor(private adapter: SqliteAdapter) {}

  async connect(): Promise<DbClient> {
    return new TauriSqliteClient(this.adapter);
  }

  async end(): Promise<void> {
    await this.adapter.closePool();
  }
}

export class TauriSqliteAdapter implements DbAdapter {
  private baseAdapter: SqliteAdapter;
  private tauriDbPath: string | null = null;

  constructor() {
    this.baseAdapter = new SqliteAdapter();
  }

  async initTauriPath(): Promise<string> {
    if (isTauriEnvironment()) {
      const customPath = await tauriGetLocalDbPath();
      if (customPath) {
        this.tauriDbPath = customPath;
        process.env.SQLITE_DB_PATH = customPath;
        return customPath;
      }
    }
    return getSqlitePath();
  }

  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    await this.initTauriPath();
    return this.baseAdapter.query<T>(text, params);
  }

  getPool(): DbPool {
    return new TauriSqlitePool(this.baseAdapter);
  }

  async getClient(): Promise<DbClient> {
    await this.initTauriPath();
    return new TauriSqliteClient(this.baseAdapter);
  }

  async closePool(): Promise<void> {
    await this.baseAdapter.closePool();
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.initTauriPath();
      return await this.baseAdapter.checkConnection();
    } catch {
      return false;
    }
  }
}
