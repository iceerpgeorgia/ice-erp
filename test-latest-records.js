const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('Fetching latest 5 records by created_at...\n');
  
  const result = await prisma.$queryRaw`
    SELECT id, transaction_date, correction_date, exchange_rate, created_at
    FROM consolidated_bank_accounts
    ORDER BY created_at DESC
    LIMIT 5
  `;
  
  result.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`  transaction_date: ${r.transaction_date}`);
    console.log(`  correction_date: ${r.correction_date}`);
    console.log(`  exchange_rate: ${r.exchange_rate}`);
    console.log(`  created_at: ${r.created_at}`);
    console.log('');
  });
  
  console.log('\nNow testing API with one of these IDs...\n');
  const testId = result[0].id;
  
  const apiUrl = `http://localhost:3000/api/bank-transactions?ids=${testId}`;
  console.log(`Fetching: ${apiUrl}\n`);
  
  const response = await fetch(apiUrl);
  const json = await response.json();
  
  if (json.data && json.data.length > 0) {
    const record = json.data[0];
    console.log('API Response:');
    console.log(`  id: ${record.id}`);
    console.log(`  transaction_date: ${record.transaction_date}`);
    console.log(`  correction_date: ${record.correction_date}`);
    console.log(`  exchange_rate: ${record.exchange_rate}`);
    console.log(`  created_at: ${record.created_at}`);
  } else {
    console.log('No data returned from API');
  }
  
})().finally(() => prisma.$disconnect());
