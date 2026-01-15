// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// Always use Supabase connection (REMOTE_DATABASE_URL) when available
// Falls back to DATABASE_URL for local development without Supabase
const databaseUrl = process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL;

// Configure for Supabase pooler with pgbouncer
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
} as any;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
