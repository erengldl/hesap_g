type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string, ttlMs: number, factory: () => T): T {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const value = factory();
  cache.set(key, {
    value,
    expiresAt: now + ttlMs,
  });

  return value;
}

