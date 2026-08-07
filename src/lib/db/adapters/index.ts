export { PgAdapter } from "./pg";
export { SqliteAdapter } from "./sqlite";
export { TauriSqliteAdapter } from "./tauri-sqlite";
export type { DbAdapter, DbClient, DbPool, DbResult } from "./types";

import { PgAdapter } from "./pg";
import { SqliteAdapter } from "./sqlite";
import { TauriSqliteAdapter } from "./tauri-sqlite";
import type { DbAdapter } from "./types";

export function getAdapter(): DbAdapter {
  if (typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)) {
    return new TauriSqliteAdapter();
  }
  const provider = process.env.DATA_PROVIDER || "neon";
  if (provider === "sqlite") {
    return new SqliteAdapter();
  }
  return new PgAdapter();
}

