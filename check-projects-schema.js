const { PrismaClient } = require('@prisma/client');

const SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: SUPABASE_URL
    }
  }
});

async function checkProjectsTable() {
  try {
    // Get table columns
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'projects' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    console.log('✓ Projects table exists in Supabase');
    console.log('\nColumns in projects table:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
    // Get row count
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM projects`;
    console.log(`\nTotal rows: ${count[0].count}`);
    
    // Get sample data
    const sample = await prisma.$queryRaw`SELECT * FROM projects LIMIT 3`;
    console.log(`\nSample records: ${sample.length}`);
    if (sample.length > 0) {
      console.log('First record fields:', Object.keys(sample[0]));
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProjectsTable();
