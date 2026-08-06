import { getAdapter } from "./db/adapters";
import type { DbAdapter } from "./db/adapters/types";

let _adapter: DbAdapter | null = null;

function getAdapterInstance(): DbAdapter {
  if (!_adapter) {
    _adapter = getAdapter();
  }
  return _adapter;
}

export const provider =
  process.env.DATA_PROVIDER === "sqlite" ? "sqlite" : "pg";

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  return getAdapterInstance().query<T>(text, params);
}

export function getPool() {
  return getAdapterInstance().getPool();
}

export async function getClient() {
  return getAdapterInstance().getClient();
}

export async function closePool(): Promise<void> {
  if (_adapter) {
    await _adapter.closePool();
    _adapter = null;
  }
}

export async function checkConnection(): Promise<boolean> {
  return getAdapterInstance().checkConnection();
}

export { PgAdapter } from "./db/adapters/pg";
export {
  SqliteAdapter,
  isSqliteMode,
  getSqlitePath,
} from "./db/adapters/sqlite";
export type {
  DbAdapter,
  DbClient,
  DbPool,
  DbResult,
} from "./db/adapters/types";
