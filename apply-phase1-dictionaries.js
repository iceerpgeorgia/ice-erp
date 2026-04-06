/**
 * Apply Phase 1 dictionaries SQL (includes document_types)
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const sqlPath = path.join(__dirname, 'scripts', 'create-phase1-dictionaries.sql');

  console.log('Reading SQL file:', sqlPath);
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Applying Phase 1 dictionaries SQL...\n');
  
  // Remove comments and split by semicolon
  const cleanSql = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
    console.log('Executing:', preview + '...');
    
    try {
      await prisma.$queryRawUnsafe(statement);
      console.log('✓ Success\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  Already exists (skipped)\n');
      } else {
        console.error('❌ Error:', err.message);
        throw err;
      }
    }
  }

  console.log('✅ Phase 1 dictionaries setup complete!');
  console.log('   - currencies');
  console.log('   - document_types');
  console.log('   - project_states');
  console.log('   - mi_dimensions');
}

main()
  .then(() => prisma.$disconnect())
  .catch(error => {
    console.error('Error:', error.message);
    prisma.$disconnect();
    process.exit(1);
  });
