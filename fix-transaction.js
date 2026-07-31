const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DOCKEY = '31729032287';
const ENTRIESID = '110651720035';
const PROJECT_UUID = 'dface0a5-db2c-4fc9-93e6-ba7fc760d878';
const FINANCIAL_CODE_UUID = 'ec639125-e73f-4116-b664-0706cc47cffa';

(async () => {
  try {
    console.log('Updating transaction record...');
    
    // Update the raw record to set project_uuid and financial_code_uuid
    const result = await prisma.$queryRawUnsafe(`
      UPDATE "GE78BG0000000893486000_BOG_GEL"
      SET 
        project_uuid = $3::uuid,
        financial_code_uuid = $4::uuid,
        updated_at = NOW()
      WHERE dockey = $1 AND entriesid = $2
      RETURNING uuid, project_uuid, financial_code_uuid;
    `, DOCKEY, ENTRIESID, PROJECT_UUID, FINANCIAL_CODE_UUID);
    
    if (result && result.length > 0) {
      const row = result[0];
      console.log('✓ Transaction updated successfully!');
      console.log(`  UUID: ${row.uuid}`);
      console.log(`  Project UUID: ${row.project_uuid}`);
      console.log(`  Financial Code UUID: ${row.financial_code_uuid}`);
      console.log('\n✓ The transaction should now appear in the Handovers page!');
    } else {
      console.log('✗ No rows updated');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await prisma.$disconnect();
})();
