const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function verify() {
  const tables = await p.$queryRawUnsafe(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('attachments', 'attachment_links', 'document_types')
    ORDER BY table_name
  `);
  
  console.log('✅ Tables verified:');
  tables.forEach(t => console.log('   -', t.table_name));
  
  await p.$disconnect();
}

verify().catch(e => { console.error(e); p.$disconnect(); process.exit(1); });
