/**
 * Apply attachments migration directly to the database
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const migrationPath = path.join(
    __dirname,
    'prisma',
    'migrations',
    '20260406150000_add_attachments_base',
    'migration.sql'
  );

  console.log('Reading migration file:', migrationPath);
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Applying migration...\n');
  
  try {
    // Split by statement (simple approach - works for our migration)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

    for (const statement of statements) {
      if (statement) {
        console.log('Executing:', statement.substring(0, 80) + '...');
        await prisma.$executeRawUnsafe(statement);
        console.log('✓ Success\n');
      }
    }

    console.log('✅ Migration applied successfully!');
    
    // Mark migration as applied in Prisma's migration table
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" 
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        'manual_' || gen_random_uuid()::text,
        NOW(),
        '20260406150000_add_attachments_base',
        NULL,
        NULL,
        NOW(),
        1
      )
      ON CONFLICT (migration_name) DO NOTHING
    `);
    
    console.log('✅ Migration recorded in Prisma migrations table');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    
    // Check if tables already exist
    const checkAttachments = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attachments'
      )
    `);
    
    const checkLinks = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'attachment_links'
      )
    `);
    
    if (checkAttachments[0].exists && checkLinks[0].exists) {
      console.log('ℹ️  Tables already exist - migration may have been partially applied');
      console.log('   Marking as applied in migrations table...');
      
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations" 
          (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (
          gen_random_uuid()::text,
          'manual_' || gen_random_uuid()::text,
          NOW(),
          '20260406150000_add_attachments_base',
          NULL,
          NULL,
          NOW(),
          1
        )
        ON CONFLICT (migration_name) DO NOTHING
      `);
      
      console.log('✅ Migration marked as applied');
    } else {
      throw error;
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(error => {
    console.error(error);
    prisma.$disconnect();
    process.exit(1);
  });
