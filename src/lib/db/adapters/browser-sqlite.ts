/**
 * BrowserSqliteAdapter
 *
 * Adaptateur de base de données unifié pour le navigateur web (SQLite-WASM + OPFS).
 * Permet d'interroger la base de données locale installée sur le device de l'utilisateur
 * exactement avec les mêmes méthodes (`query`, `getPool`, `getClient`, `checkConnection`)
 * et le même contrat `DbAdapter` qu'en mode dev / desktop.
 */

import { browserDb } from "@/lib/browser-db";
import type { DbAdapter, DbClient, DbPool } from "./types";

export class BrowserSqliteClient implements DbClient {
  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    if (!browserDb.isReady()) {
      await browserDb.init();
    }
    const rows = browserDb.query<T>(text, params);
    return { rows, rowCount: rows.length };
  }

  release(): void {}
}

export class BrowserSqlitePool implements DbPool {
  async connect(): Promise<DbClient> {
    return new BrowserSqliteClient();
  }

  async end(): Promise<void> {}
}

export class BrowserSqliteAdapter implements DbAdapter {
  async query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    if (!browserDb.isReady()) {
      await browserDb.init();
    }
    const rows = browserDb.query<T>(text, params);
    return { rows, rowCount: rows.length };
  }

  getPool(): DbPool {
    return new BrowserSqlitePool();
  }

  async getClient(): Promise<DbClient> {
    return new BrowserSqliteClient();
  }

  async closePool(): Promise<void> {}

  async checkConnection(): Promise<boolean> {
    try {
      if (!browserDb.isReady()) {
        await browserDb.init();
      }
      return browserDb.isReady();
    } catch {
      return false;
    }
  }
}
