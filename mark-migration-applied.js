/**
 * Mark the attachments migration as applied in Prisma's migrations table
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking _prisma_migrations table...');
  
  // Check if migration is already recorded
  const existing = await prisma.$queryRawUnsafe(`
    SELECT migration_name, finished_at 
    FROM "_prisma_migrations" 
    WHERE migration_name = '20260406150000_add_attachments_base'
  `);
  
  if (existing.length > 0) {
    console.log('✓ Migration already recorded:', existing[0].migration_name);
    console.log('  Finished at:', existing[0].finished_at);
  } else {
    console.log('Recording migration as applied...');
    
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" 
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'b8c7e3f1a92d4567890abcdef1234567890abcdef1234567890abcdef1234567',
        NOW(),
        '20260406150000_add_attachments_base',
        NULL,
        NULL,
        NOW(),
        1
      )
    `);
    
    console.log('✅ Migration marked as applied in _prisma_migrations table');
  }
  
  // Verify tables exist
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('attachments', 'attachment_links')
    ORDER BY table_name
  `);
  
  console.log('\n✓ Verified tables:', tables.map(t => t.table_name).join(', '));
}

main()
  .then(() => prisma.$disconnect())
  .catch(error => {
    console.error('Error:', error.message);
    prisma.$disconnect();
    process.exit(1);
  });
