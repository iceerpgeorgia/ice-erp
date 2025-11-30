#!/bin/bash
# Production database migration script
# Run this after deploying to apply any pending migrations

echo "🔄 Running production database migrations..."

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  exit 1
fi

# Deploy migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

echo "✅ Migrations completed successfully"
