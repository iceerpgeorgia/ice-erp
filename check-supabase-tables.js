const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.vercel' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  try {
    console.log('Checking tables in Supabase...\n');
    
    // List all tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log('All tables in public schema:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    console.log('\n');
    
    // Check if parsing tables exist
    const parsingSchemes = await prisma.$queryRaw`
      SELECT * FROM information_schema.tables 
      WHERE table_name = 'parsing_schemes'
    `;
    
    const parsingRules = await prisma.$queryRaw`
      SELECT * FROM information_schema.tables 
      WHERE table_name = 'parsing_scheme_rules'
    `;
    
    console.log(`parsing_schemes table exists: ${parsingSchemes.length > 0 ? 'YES' : 'NO'}`);
    console.log(`parsing_scheme_rules table exists: ${parsingRules.length > 0 ? 'YES' : 'NO'}`);
    
    if (parsingSchemes.length > 0) {
      console.log('\nData in parsing_schemes:');
      const schemes = await prisma.$queryRaw`SELECT * FROM parsing_schemes`;
      console.log(schemes);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
