interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in ms
}

// Module-level in-memory cache store
// Persists across requests within the same Worker isolate / process
const cacheStore = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached item or execute fetcher and store result with TTL
 * @param key Unique cache key
 * @param ttlSeconds Time-to-live in seconds
 * @param fetcher Async function to fetch fresh data on cache miss / expiration
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const entry = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await fetcher();
  cacheStore.set(key, {
    data,
    expiresAt: now + ttlSeconds * 1000,
  });

  return data;
}

/**
 * Manually invalidate a single key
 */
export function invalidate(key: string): void {
  cacheStore.delete(key);
}

/**
 * Invalidate all keys matching a prefix (e.g. "master:")
 */
export function invalidatePrefix(prefix: string): void {
  for (const key of Array.from(cacheStore.keys())) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Invalidate all cached data
 */
export function invalidateAll(): void {
  cacheStore.clear();
}
