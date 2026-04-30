/**
 * Lightweight in-memory rate limiter (token bucket).
 *
 * Suitable for single-instance protection of expensive endpoints (uploads,
 * webhooks, NBG sync). For multi-instance / production-grade rate limiting,
 * swap the backing store for Redis (e.g. `@upstash/ratelimit`).
 *
 * Usage:
 *
 *   const rl = rateLimit({ windowMs: 60_000, max: 10 });
 *   const limited = await rl.check(req);
 *   if (limited) return limited; // 429 NextResponse
 */

import { NextResponse } from "next/server";

type Entry = { count: number; resetAt: number };

interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per window per key. */
  max: number;
  /** Custom key extractor. Defaults to `x-forwarded-for` first IP, falling back to `cf-connecting-ip` then `unknown`. */
  keyFn?: (req: Request) => string;
  /** Bucket name — used when multiple limiters share the process. */
  bucket?: string;
}

const buckets = new Map<string, Map<string, Entry>>();

function getStore(name: string): Map<string, Entry> {
  let store = buckets.get(name);
  if (!store) {
    store = new Map();
    buckets.set(name, store);
  }
  return store;
}

function defaultKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, keyFn = defaultKey, bucket = "default" } = options;
  const store = getStore(bucket);

  return {
    /**
     * Returns a 429 NextResponse if the caller is over the limit, otherwise null.
     */
    async check(req: Request): Promise<NextResponse | null> {
      const key = keyFn(req);
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || entry.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return null;
      }

      entry.count += 1;
      if (entry.count > max) {
        const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        return NextResponse.json(
          { error: "Too many requests", retryAfter },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(max),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.floor(entry.resetAt / 1000)),
            },
          },
        );
      }
      return null;
    },

    /**
     * Manually reset a key. Useful in tests.
     */
    reset(req: Request): void {
      store.delete(keyFn(req));
    },
  };
}

/** Reasonable defaults for upload/expensive endpoints. */
export const uploadRateLimit = rateLimit({ windowMs: 60_000, max: 10, bucket: "uploads" });

/** Reasonable defaults for public webhooks. */
export const webhookRateLimit = rateLimit({ windowMs: 60_000, max: 30, bucket: "webhooks" });
