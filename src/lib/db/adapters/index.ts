export { PgAdapter } from "./pg";
export { SqliteAdapter } from "./sqlite";
export type { DbAdapter, DbClient, DbPool, DbResult } from "./types";

import { PgAdapter } from "./pg";
import { SqliteAdapter } from "./sqlite";
import type { DbAdapter } from "./types";

export function getAdapter(): DbAdapter {
  const provider = process.env.DATA_PROVIDER || "neon";
  if (provider === "sqlite") {
    return new SqliteAdapter();
  }
  return new PgAdapter();
}
