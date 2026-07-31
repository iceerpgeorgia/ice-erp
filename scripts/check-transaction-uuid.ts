import { prisma } from '../lib/prisma';

async function checkTransaction() {
  const uuid = '3ca0c418-67a3-58cb-a249-fab2df655909';
  
  console.log('\n=== Looking for transaction UUID:', uuid);

  // Query across all raw bank account tables
  const tables = [
    'GE78BG0000000893486000_BOG_GEL',
    'GE74BG0000000586388146_BOG_USD',
    'GE78BG0000000893486000_BOG_USD',
    'GE78BG0000000893486000_BOG_EUR',
    'GE78BG0000000893486000_BOG_AED',
    'GE78BG0000000893486000_BOG_GBP',
    'GE78BG0000000893486000_BOG_KZT',
    'GE78BG0000000893486000_BOG_CNY',
    'GE78BG0000000893486000_BOG_TRY',
    'GE65TB7856036050100002_TBC_GEL',
    'GE39TB7856036150100001_TBC_USD',
    'GE39TB7856036150100001_TBC_EUR',
    'GE79TB7856045067800004_TBC_GEL',
    'GE52TB7856045067800005_TBC_GEL',
  ];

  for (const table of tables) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT uuid, project_uuid, payment_id, financial_code_uuid, counteragent_uuid, 
                counteragent_name, transaction_date, description, account_currency_amount, 
                nominal_amount FROM "${table}" WHERE uuid = $1 LIMIT 1`,
        uuid
      ) as any[];

      if (result && result.length > 0) {
        const row = result[0];
        console.log(`\n✓ Found in table: ${table}`);
        console.log('\n=== TRANSACTION DETAILS ===');
        console.log('UUID:', row.uuid);
        console.log('Project UUID:', row.project_uuid);
        console.log('Payment ID:', row.payment_id);
        console.log('Financial Code UUID:', row.financial_code_uuid);
        console.log('Counteragent UUID:', row.counteragent_uuid);
        console.log('Counteragent Name:', row.counteragent_name);
        console.log('Transaction Date:', row.transaction_date);
        console.log('Description:', row.description);
        console.log('Account Currency Amount:', row.account_currency_amount);
        console.log('Nominal Amount:', row.nominal_amount);

        console.log('\n=== VALIDATION CHECKS ===');
        console.log('✓ Has project_uuid:', !!row.project_uuid);
        console.log('✓ Has payment_id:', !!row.payment_id);
        console.log('✓ Has financial_code_uuid:', !!row.financial_code_uuid);

        if (row.payment_id) {
          console.log('\n=== CHECKING PAYMENT ===');
          const payment = await prisma.payments.findUnique({
            where: { payment_id: row.payment_id },
            include: { financial_codes: true },
          });

          if (payment) {
            console.log('Payment found!');
            console.log('  Financial Code:', payment.financial_codes?.code);
            console.log('  Is Income:', payment.financial_codes?.is_income);
            if (!payment.financial_codes?.is_income) {
              console.log('  ⚠️ Problem: This financial code is NOT income!');
              console.log('     Handovers only shows income transactions.');
            }
          } else {
            console.log('❌ Payment NOT found - this payment_id does not exist in payments table!');
          }
        } else {
          console.log('\n❌ NO PAYMENT_ID - this is why it\'s not in handovers!');
        }

        if (row.financial_code_uuid) {
          console.log('\n=== CHECKING FINANCIAL CODE ===');
          const fc = await prisma.financial_codes.findUnique({
            where: { uuid: row.financial_code_uuid },
          });
          
          if (fc) {
            console.log('Financial Code:', fc.code);
            console.log('Is Income:', fc.is_income);
          }
        }

        await prisma.$disconnect();
        process.exit(0);
      }
    } catch (e) {
      // Continue to next table
    }
  }

  console.log(`\n✗ Transaction UUID not found in any table`);
  await prisma.$disconnect();
  process.exit(1);
}

checkTransaction().catch(console.error);
