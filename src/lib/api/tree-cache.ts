type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

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
