// Test production database directly using production DATABASE_URL
const { PrismaClient } = require('@prisma/client');

// Read from .env.production.local (pulled from Vercel)
require('dotenv').config({ path: '.env.production.local' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL
    }
  }
});

async function checkProductionAttachments() {
  try {
    console.log('Testing PRODUCTION database...');
    console.log('URL:', (process.env.DATABASE_URL || '').substring(0, 60) + '...\n');
    
    const total = await prisma.attachments.count();
    const active = await prisma.attachments.count({ where: { is_active: true } });
    
    console.log(`Total attachments: ${total}`);
    console.log(`Active: ${active}`);
    console.log(`Inactive: ${total - active}\n`);
    
    if (total > 0) {
      console.log('Sample attachments:');
      const samples = await prisma.attachments.findMany({
        take: 5,
        select: {
          id: true,
          uuid: true,
          file_name: true,
          is_active: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
      });
      console.table(samples);
      
      // Check if any have links
      console.log('\nChecking attachment links...');
      const withLinks = await prisma.$queryRaw`
        SELECT a.file_name, COUNT(al.id) as link_count
        FROM attachments a
        LEFT JOIN attachment_links al ON al.attachment_uuid = a.uuid
        GROUP BY a.id, a.file_name
        LIMIT 5
      `;
      console.table(withLinks);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProductionAttachments();
