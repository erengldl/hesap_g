type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string, ttlMs: number, factory: () => T): T;
export async function getCachedValue<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T>;
export function getCachedValue<T>(key: string, ttlMs: number, factory: () => T | Promise<T>): T | Promise<T> {
  const now = Date.now();
  const cached = cache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const value = factory();
  if (value instanceof Promise) {
    return value.then((resolved) => {
      cache.set(key, { value: resolved, expiresAt: now + ttlMs });
      return resolved;
    });
  }

  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

