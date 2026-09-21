/**
 * High-performance In-Memory API Cache & Request Deduplication Engine
 *
 * Provides:
 * 1. Instant synchronous cache retrieval (0ms initial render on re-visiting pages).
 * 2. Stale-While-Revalidate (SWR): Returns cached data instantly and updates quietly in background.
 * 3. Request Deduplication: Merges multiple simultaneous requests for the same key into a single promise.
 * 4. Cache Invalidation: Allows targeted or wildcard clearing upon mutations.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes fresh TTL
const STALE_TTL_MS = 10 * 60 * 1000;  // 10 minutes stale-while-revalidate window

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();
const listeners = new Map<string, Set<(data: any) => void>>();

export function getCachedData<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  const now = Date.now();
  const age = now - entry.timestamp;

  if (age > STALE_TTL_MS) {
    cacheStore.delete(key);
    return null;
  }

  const isStale = age > entry.ttl;
  return { data: entry.data as T, isStale };
}

export function setCachedData<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  cacheStore.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });

  // Notify active listeners subscribed to this cache key
  const keyListeners = listeners.get(key);
  if (keyListeners) {
    keyListeners.forEach((listener) => listener(data));
  }
}

export function invalidateCache(keyOrPattern?: string | RegExp): void {
  if (!keyOrPattern) {
    cacheStore.clear();
    return;
  }

  if (typeof keyOrPattern === 'string') {
    cacheStore.delete(keyOrPattern);
    return;
  }

  for (const key of cacheStore.keys()) {
    if (keyOrPattern.test(key)) {
      cacheStore.delete(key);
    }
  }
}

export function subscribeToCache<T>(key: string, callback: (data: T) => void): () => void {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  const set = listeners.get(key)!;
  const listener = callback as (data: unknown) => void;
  set.add(listener);

  return () => {
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(key);
    }
  };
}

export async function fetchWithDeduplication<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const existingPromise = inFlightRequests.get(key);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      setCachedData(key, data, ttlMs);
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}
