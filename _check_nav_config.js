const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [folderCount, itemCount] = await Promise.all([
    prisma.userNavFolder.count(),
    prisma.userNavItem.count(),
  ]);
  const folders = await prisma.userNavFolder.findMany({
    select: { id: true, name: true, userId: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  const items = await prisma.userNavItem.findMany({
    select: { id: true, routeKey: true, folderId: true, sortOrder: true, userId: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('=== Nav Config ===');
  console.log('Folders:', folderCount);
  console.log('Items:', itemCount);
  console.log('\nFolders:');
  console.table(folders);
  console.log('\nItems:');
  console.table(items);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
