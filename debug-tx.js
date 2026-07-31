#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const uuid = '3ca0c418-67a3-58cb-a249-fab2df655909';
  
  console.log('\n=== Checking transaction UUID:', uuid);

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
      );

      if (result && result.length > 0) {
        const row = result[0];
        console.log(`\n✓ FOUND IN TABLE: ${table}`);
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

        if (row.payment_id) {
          console.log('\n=== CHECKING PAYMENT:', row.payment_id, '===');
          const payment = await prisma.payments.findUnique({
            where: { payment_id: row.payment_id },
            include: { 
              financial_codes: true,
              counteragents: true,
              projects: true,
            },
          });

          if (payment) {
            console.log('✓ Payment FOUND');
            console.log('  Payment ID:', payment.payment_id);
            console.log('  Project UUID:', payment.project_uuid);
            console.log('  Counteragent UUID:', payment.counteragent_uuid);
            console.log('  Financial Code UUID:', payment.financial_code_uuid);
            
            if (payment.financial_codes) {
              console.log('\n  Financial Code Info:');
              console.log('    Code:', payment.financial_codes.code);
              console.log('    Is Income:', payment.financial_codes.is_income);
              console.log('    ← This is what blocks the transaction from handovers!');
            }
            
            if (payment.projects) {
              console.log('\n  Linked Project:', payment.projects.index, '-', payment.projects.name);
            }
            
            if (payment.counteragents) {
              console.log('\n  Linked Counteragent:', payment.counteragents.name);
            }
          } else {
            console.log('✗ Payment NOT FOUND - payment_id', row.payment_id, 'does not exist in payments table!');
          }
        } else {
          console.log('\n✗ NO PAYMENT_ID SET - Transaction not linked to any payment');
        }

        console.log('\n=== DIAGNOSIS ===');
        if (!row.project_uuid) {
          console.log('❌ Transaction has NO project_uuid');
        } else {
          console.log('✓ Transaction HAS project_uuid:', row.project_uuid);
        }
        
        if (!row.payment_id) {
          console.log('❌ Transaction has NO payment_id (this is the problem!)');
        } else {
          console.log('✓ Transaction HAS payment_id:', row.payment_id);
        }

        await prisma.$disconnect();
        process.exit(0);
      }
    } catch (e) {
      // continue
    }
  }

  console.log(`\n✗ Transaction UUID not found in any table`);
  await prisma.$disconnect();
  process.exit(1);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
