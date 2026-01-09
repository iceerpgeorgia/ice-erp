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
    console.log('Checking database connection...');
    console.log('Connection URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    console.log('\n');
    
    // Check current database
    const db = await prisma.$queryRaw`SELECT current_database()`;
    console.log('Current database:', db);
    
    // Check schema
    const schemas = await prisma.$queryRaw`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
    `;
    console.log('Available schemas:', schemas);
    
    // Check parsing tables in all schemas
    const parsingTables = await prisma.$queryRaw`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('parsing_schemes', 'parsing_scheme_rules')
      ORDER BY table_schema, table_name
    `;
    
    console.log('\nParsing tables found:');
    console.log(parsingTables);
    
    // Try to query the tables
    console.log('\nTrying to query parsing_schemes...');
    try {
      const schemes = await prisma.$queryRaw`SELECT * FROM parsing_schemes`;
      console.log('SUCCESS - Found schemes:', schemes);
    } catch (e) {
      console.log('ERROR querying parsing_schemes:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
