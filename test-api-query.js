// Test the actual API endpoint logic locally
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.production.local' });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || process.env.DIRECT_DATABASE_URL
    }
  }
});

async function testAPIQuery() {
  try {
    const page = 1;
    const limit = 50;
    const offset = 0;
    
    const whereConditions = ['a.is_active = true'];
    const params = [];
    const whereClause = whereConditions.join(' AND ');
    
    params.push(limit, offset);
    
    console.log('Testing API query...');
    console.log('WHERE:', whereClause);
    console.log('PARAMS:', params);
    console.log('');
    
    const attachments = await prisma.$queryRawUnsafe(
      `SELECT 
         a.id,
         a.uuid,
         a.file_name,
         a.is_active,
         json_agg(
           json_build_object(
             'link_uuid', al.uuid,
             'owner_table', al.owner_table,
             'owner_uuid', al.owner_uuid
           )
         ) FILTER (WHERE al.uuid IS NOT NULL) as links
       FROM attachments a
       LEFT JOIN document_types dt ON dt.uuid = a.document_type_uuid
       LEFT JOIN currencies c ON c.uuid = a.document_currency_uuid
       LEFT JOIN attachment_links al ON al.attachment_uuid = a.uuid
       WHERE ${whereClause}
       GROUP BY a.id, a.uuid, a.file_name, a.is_active
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      ...params
    );
    
    console.log(`Found ${attachments.length} attachments\n`);
    
    if (attachments.length > 0) {
      console.log('Sample attachments:');
      console.table(attachments.slice(0, 3).map(a => ({
        id: a.id,
        file_name: a.file_name,
        has_links: a.links ? a.links.length : 0
      })));
    }
    
    // Test count query
    const countResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT a.id) as total
       FROM attachments a
       LEFT JOIN attachment_links al ON al.attachment_uuid = a.uuid
       WHERE ${whereClause}`
    );
    
    console.log('\nTotal count:', countResult[0].total);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testAPIQuery();
