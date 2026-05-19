/**
 * Simple in-memory rate limiter for API routes.
 * For production, replace with Redis-based solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

interface RateLimitOptions {
  /** Maximum number of requests within the window */
  limit?: number;
  /** Time window in seconds */
  windowSeconds?: number;
  /** Key prefix for this rate limiter */
  prefix?: string;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited.
 * Uses IP-based keys by default.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const { limit = 60, windowSeconds = 60, prefix = "rl" } = options;

  cleanup();

  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    // New window
    const entry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, entry);
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: entry.resetAt,
    };
  }

  existing.count++;

  if (existing.count > limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  return {
    success: true,
    limit,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "127.0.0.1";
}

/**
 * Apply rate limiting to an API route.
 * Returns null if request is allowed, or a Response if rate limited.
 */
export function checkRateLimit(
  request: Request,
  options?: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(request);
  return rateLimit(ip, options);
}
