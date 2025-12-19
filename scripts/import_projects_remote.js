// Import to Supabase (remote database)
const fs = require("fs");
require('dotenv').config({ path: '.env.local' });

// Override DATABASE_URL with REMOTE_DATABASE_URL
process.env.DATABASE_URL = process.env.REMOTE_DATABASE_URL;

// Now require Prisma with the remote URL
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Import the main import function
const { importProjects } = require('./import_projects');

async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || 'projects_template.xlsx';
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log('🌐 Importing to REMOTE database (Supabase)...\n');
  
  try {
    await importProjects(filePath, { prisma });
  } catch (error) {
    console.error(`❌ Import failed:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
