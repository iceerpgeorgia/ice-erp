const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const toComparableDate = (ddmmyyyy) => {
  if (!ddmmyyyy || ddmmyyyy.length !== 10) return null;
  const parts = ddmmyyyy.split('.');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

async function testFilter() {
  console.log('=== Testing date filtering with memory filter ===');
  
  const transactions = await prisma.consolidatedBankAccount.findMany({
    take: 50000,
    orderBy: { id: 'desc' }
  });
  
  console.log(`Total records: ${transactions.length}`);
  
  // Test filter: fromDate = '01.01.2025'
  const fromDate = '01.01.2025';
  const fromComparable = toComparableDate(fromDate);
  console.log(`\nFiltering >= ${fromDate} (ISO: ${fromComparable})`);
  
  const filtered = transactions.filter(t => {
    const txDateComparable = toComparableDate(t.transactionDate);
    if (!txDateComparable) return true;
    return txDateComparable >= fromComparable;
  });
  
  console.log(`Filtered: ${filtered.length} records`);
  console.log('\nFirst 10 filtered dates:');
  filtered.slice(0, 10).forEach(t => {
    const iso = toComparableDate(t.transactionDate);
    console.log(` - ${t.transactionDate} (${iso})`);
  });
  
  console.log('\nLast 10 filtered dates:');
  filtered.slice(-10).forEach(t => {
    const iso = toComparableDate(t.transactionDate);
    console.log(` - ${t.transactionDate} (${iso})`);
  });
  
  await prisma.$disconnect();
}

testFilter().catch(console.error);
