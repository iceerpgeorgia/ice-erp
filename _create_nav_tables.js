const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_nav_folders (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      icon VARCHAR(50) NOT NULL DEFAULT 'Folder',
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS user_nav_folders_userId_idx ON user_nav_folders("userId")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS user_nav_items (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "routeKey" VARCHAR(255) NOT NULL,
      icon VARCHAR(50),
      "folderId" TEXT REFERENCES user_nav_folders(id) ON DELETE SET NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      UNIQUE("userId", "routeKey")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS user_nav_items_userId_idx ON user_nav_items("userId")
  `);
  console.log('Tables created OK');
}

main().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
