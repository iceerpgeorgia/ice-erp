const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    console.log('🔍 Checking table schema for GE65TB7856036050100002_TBC_GEL...\n');

    const schema = await prisma.$queryRawUnsafe(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'GE65TB7856036050100002_TBC_GEL'
      ORDER BY ordinal_position
    `);

    console.log('━'.repeat(80));
    schema.forEach((col) => {
      const nullable = col.is_nullable === 'YES' ? '✓ Nullable' : '✗ NOT NULL';
      const deflt = col.column_default ? `(default: ${col.column_default})` : '';
      console.log(`${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable} ${deflt}`);
    });
    console.log('━'.repeat(80));

    // Also show a sample record to understand structure
    console.log('\n\n📋 Sample record from table:\n');
    const sample = await prisma.$queryRawUnsafe(`
      SELECT * FROM "GE65TB7856036050100002_TBC_GEL" LIMIT 1
    `);

    if (sample && sample.length > 0) {
      console.log('Columns in first record:');
      Object.keys(sample[0]).forEach((key) => {
        console.log(`  ${key}: ${sample[0][key]}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
