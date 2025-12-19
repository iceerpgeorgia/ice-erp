require('dotenv').config({ path: '.env.local' });

// Use REMOTE_DATABASE_URL for Supabase
const remoteUrl = process.env.REMOTE_DATABASE_URL;
if (!remoteUrl) {
  console.error('❌ REMOTE_DATABASE_URL not found in .env.local');
  process.exit(1);
}

// Temporarily override DATABASE_URL
const originalUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = remoteUrl;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function truncateRemote() {
  try {
    console.log('🌐 Connecting to Supabase...\n');
    
    // Delete employees first
    const empResult = await prisma.projectEmployee.deleteMany();
    console.log(`✓ Deleted ${empResult.count} project employee assignments from Supabase`);
    
    const result = await prisma.project.deleteMany();
    console.log(`✓ Deleted ${result.count} projects from Supabase\n`);
    
    console.log('✅ Supabase projects table truncated');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
    // Restore original URL
    process.env.DATABASE_URL = originalUrl;
  }
}

truncateRemote();
