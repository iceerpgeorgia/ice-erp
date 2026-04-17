/**
 * Apply module permissions migration directly to the database
 * Uses DIRECT_DATABASE_URL for proper schema migrations
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const directUrl = process.env.DIRECT_DATABASE_URL;
if (!directUrl) {
  console.error('DIRECT_DATABASE_URL not found in environment');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl,
    },
  },
});

async function main() {
  console.log('Applying module permissions migration...');
  
  try {
    // Read the migration file
    const sqlFile = resolve(process.cwd(), 'prisma/migrations/add_module_permissions_system/migration.sql');
    console.log(`Reading SQL file from: ${sqlFile}`);
    const sqlContent = readFileSync(sqlFile, 'utf8');
    console.log(`SQL file length: ${sqlContent.length} characters`);
    console.log(`First 200 chars: ${sqlContent.substring(0, 200)}\n`);
    
    // Simple split by semicolons, then clean up
    const rawStatements = sqlContent.split(';');
    console.log(`Split into ${rawStatements.length} parts`);
    const statements = rawStatements
      .map(s => {
        // Remove comment-only lines but keep statements with SQL after comments
        return s.split('\n')
          .filter(line => !line.trim().startsWith('--') || line.trim() === '')
          .join('\n')
          .trim();
      })
      .filter(s => s.length > 0)
      .map(s => s + ';'); // Add back the semicolon
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    // Execute each statement
    let executedCount = 0;
    for (const statement of statements) {
      try {
        const preview = statement.substring(0, 100).replace(/\s+/g, ' ');
        console.log(`${executedCount + 1}. ${preview}...`);
        await prisma.$executeRawUnsafe(statement);
        executedCount++;
        console.log(`   ✅ Success`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || error.message.includes('duplicate key')) {
          console.log(`   ⚠️  Skipped (already exists)`);
          executedCount++;
        } else {
          console.error(`   ❌ Failed: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log(`\n✅ Migration applied successfully (${executedCount} statements executed)`);

    
    // Verify tables were created
    const moduleCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Module"`;
    console.log('✅ Module table verified');
    
    const featureCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "ModuleFeature"`;
    console.log('✅ ModuleFeature table verified');
    
    const userPermCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "UserPermission"`;
    console.log('✅ UserPermission table verified');
    
    const rolePermCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "RolePermission"`;
    console.log('✅ RolePermission table verified');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
