const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTriggers() {
  console.log('=== CREATING PREVENTIVE TRIGGERS ===\n');
  
  console.log('Creating function sync_transaction_project_from_payment()...\n');
  
  // Create the trigger function
  await prisma.$queryRawUnsafe(`
    CREATE OR REPLACE FUNCTION sync_transaction_project_from_payment()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.payment_id IS NOT NULL AND NEW.project_uuid IS NULL THEN
        SELECT project_uuid, financial_code_uuid INTO NEW.project_uuid, NEW.financial_code_uuid
        FROM payments
        WHERE payment_id = NEW.payment_id
        LIMIT 1;
      END IF;
      
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  console.log('✓ Function created\n');
  
  // Attach triggers to each table
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE65TB7856036050100002_TBC_GEL',
    'GE78BG0000000893486000_BOG_USD',
  ];
  
  for (const table of tables) {
    const triggerName = `sync_project_from_payment_${table.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    console.log(`Creating trigger for ${table}...`);
    
    try {
      // Drop if exists
      await prisma.$queryRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON "${table}"`);
      
      // Create new trigger
      await prisma.$queryRawUnsafe(`
        CREATE TRIGGER ${triggerName}
        BEFORE INSERT OR UPDATE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION sync_transaction_project_from_payment();
      `);
      
      console.log(`✓ Trigger created: ${triggerName}\n`);
    } catch (err) {
      console.log(`⚠ Error creating trigger for ${table}: ${err.message}\n`);
    }
  }
  
  console.log('\n=== VERIFICATION ===\n');
  
  // Verify triggers exist
  const triggers = await prisma.$queryRawUnsafe(`
    SELECT trigger_name, event_object_table, trigger_type
    FROM information_schema.triggers
    WHERE trigger_name LIKE 'sync_project_from_payment%'
    ORDER BY event_object_table
  `);
  
  console.log(`Created ${triggers.length} triggers:\n`);
  for (const t of triggers) {
    console.log(`✓ ${t.trigger_name}`);
    console.log(`  - Table: ${t.event_object_table}`);
    console.log(`  - Type: ${t.trigger_type}\n`);
  }
  
  console.log('=== RESULT ===\n');
  console.log('✅ Preventive triggers are now active!');
  console.log('\nHow it works:');
  console.log('1. When a transaction is inserted/updated with payment_id');
  console.log('2. Trigger automatically syncs project_uuid from the payment record');
  console.log('3. Prevents NULL project_uuid when payment has a valid project');
  console.log('4. Transactions remain visible in API queries');
  
  await prisma.$disconnect();
}

createTriggers().catch(console.error);
