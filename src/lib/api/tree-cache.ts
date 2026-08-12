type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export interface ProcedureRow {
  code: string;
  title: string;
  category?: string;
  description?: string;
  priority?: string;
}

export class TreeCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttlMs: number;

  constructor(ttlMs = 30_000) {
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const registryTreeCache = new TreeCache(30_000);

const PROCEDURES_CACHE_TTL_MS = 30_000;
const proceduresCache = new Map<string, { value: ProcedureRow[]; expiresAt: number }>();

export function getCachedProcedures(): ProcedureRow[] | null {
  const entry = proceduresCache.get("all");
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    proceduresCache.delete("all");
    return null;
  }
  return entry.value;
}

export function setCachedProcedures(procedures: ProcedureRow[]): void {
  proceduresCache.set("all", {
    value: procedures,
    expiresAt: Date.now() + PROCEDURES_CACHE_TTL_MS,
  });
}

export function invalidateProceduresCache(): void {
  proceduresCache.delete("all");
  registryTreeCache.invalidate("tree:");
}
