type CacheEntry<T> = {
  value: T | Promise<T>;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const PENDING_ENTRY_TTL_MS = 5 * 60_000;

export function buildScopedCacheKey(baseKey: string, scopeKey: string | number | null | undefined) {
  const normalizedScope = String(scopeKey ?? "anonymous").trim() || "anonymous";
  return `${baseKey}:${normalizedScope}`;
}

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
    const pending: Promise<T> = value.then(
      (resolved) => {
        const current = cache.get(key);
        if (current?.value === pending) {
          cache.set(key, { value: resolved, expiresAt: Date.now() + ttlMs });
        }
        return resolved;
      },
      (error) => {
        const current = cache.get(key);
        if (current?.value === pending) {
          cache.delete(key);
        }
        throw error;
      }
    );
    cache.set(key, { value: pending, expiresAt: now + PENDING_ENTRY_TTL_MS });
    return pending;
  }

  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
