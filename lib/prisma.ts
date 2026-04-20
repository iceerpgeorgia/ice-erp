// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// In production serverless (Vercel), use the pooled URL (pgbouncer / transaction mode)
// to avoid exhausting direct connection slots. In development, prefer the direct URL
// so Prisma's prepared-statement cache works smoothly with introspection tools.
const databaseUrl =
  process.env.NODE_ENV === "production"
    ? (process.env.DATABASE_URL || process.env.REMOTE_DATABASE_URL || process.env.DIRECT_DATABASE_URL)
    : (process.env.DIRECT_DATABASE_URL || process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL);

const withPoolParams = (url?: string) => {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '1');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '20');
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

// Configure for Supabase pooler with pgbouncer
// Important: do not pass datasources.db.url when it's undefined,
// otherwise Prisma throws during module evaluation in build environments.
const prismaClientOptions: any = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
};

const pooledUrl = withPoolParams(databaseUrl);
if (pooledUrl) {
  prismaClientOptions.datasources = {
    db: {
      url: pooledUrl,
    },
  };
}

export const getPooledDatabaseUrl = () => pooledUrl;

// Always cache the singleton regardless of environment.
// In serverless (Vercel), the global object is shared across warm invocations
// within the same container — caching here prevents opening a new connection pool
// on every request and exhausting PostgreSQL connection slots.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

globalForPrisma.prisma = prisma;

// Retry wrapper for transient connection pool errors (e.g. Supabase session-mode pool exhaustion).
// Use: const result = await withRetry(() => prisma.someModel.findMany(...));
const RETRYABLE_PATTERNS = [
  'MaxClientsInSessionMode',
  'max clients reached',
  'pool_size',
  'remaining connection slots are reserved',
  'too many connections',
  'Connection timed out',
];

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return RETRYABLE_PATTERNS.some((p) => msg.includes(p));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < maxRetries && isRetryableError(error)) {
        // Exponential backoff: 200ms, 600ms, 1800ms
        await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt)));
        continue;
      }
      throw error;
    }
  }
  // Unreachable, but TypeScript needs it
  throw new Error('withRetry: max retries exceeded');
}
