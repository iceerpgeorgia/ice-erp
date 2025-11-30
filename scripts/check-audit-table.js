const { PrismaClient } = require('@prisma/client');

async function checkAuditTable() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    console.log('🔍 Checking audit_log table...\n');
    
    // Try to query the audit_log table
    const count = await prisma.auditLog.count();
    console.log('✅ audit_log table exists!');
    console.log(`📊 Total audit logs: ${count}\n`);
    
    // Get some sample records
    const samples = await prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('📋 Recent audit logs:');
    samples.forEach(log => {
      console.log(`  - ID: ${log.id}, Table: ${log.table}, Action: ${log.action}, User: ${log.userEmail || 'N/A'}, Created: ${log.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error accessing audit_log table:', error.message);
    if (error.code === 'P2021') {
      console.log('\n⚠️  The audit_log table does not exist in the database!');
      console.log('You need to run: pnpm prisma migrate deploy');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkAuditTable();
