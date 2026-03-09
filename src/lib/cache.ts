// Simple in-memory cache with TTL

const store = new Map<string, { data: unknown; ts: number }>();

export function cacheGet<T>(key: string, ttlMs: number): T | undefined {
  const entry = store.get(key);
  if (entry && Date.now() - entry.ts < ttlMs) {
    return entry.data as T;
  }
  if (entry) store.delete(key);
  return undefined;
}

export function cacheSet(key: string, data: unknown): void {
  store.set(key, { data, ts: Date.now() });
}
