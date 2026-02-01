// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Prefer direct connection when available to avoid pooler prepared-statement issues
const databaseUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.REMOTE_DATABASE_URL ||
  process.env.DATABASE_URL;

// Configure for Supabase pooler with pgbouncer
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: databaseUrl + (databaseUrl?.includes('?') ? '&' : '?') + 'connection_limit=10&pool_timeout=20',
    },
  },
} as any;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
