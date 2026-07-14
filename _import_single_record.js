const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importRecord() {
  try {
    console.log('🔄 Starting payment import...\n');

    // Step 1: Get GEL currency UUID
    console.log('1️⃣ Fetching GEL currency UUID...');
    const gelCurrency = await prisma.currencies.findUnique({
      where: { code: 'GEL' },
      select: { uuid: true }
    });

    if (!gelCurrency) {
      throw new Error('❌ GEL currency not found in database');
    }
    console.log(`   ✓ Found GEL UUID: ${gelCurrency.uuid}\n`);

    // Step 1b: Get first available insider UUID from projects
    console.log('1️⃣ Fetching insider UUID from projects...');
    const insiderResult = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT insider_uuid FROM projects WHERE insider_uuid IS NOT NULL LIMIT 1`
    );

    if (!insiderResult || insiderResult.length === 0) {
      throw new Error('❌ No insider found in projects table');
    }
    const insiderUuid = insiderResult[0].insider_uuid;
    console.log(`   ✓ Found Insider UUID: ${insiderUuid}\n`);

    // Step 2: Generate payment_id (format: 6_2_6 hex)
    const generatePaymentId = () => {
      const randomHex = (bytes) => Array.from({length: bytes}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      return `${randomHex(6)}_${randomHex(2)}_${randomHex(6)}`;
    };
    const paymentId = generatePaymentId();

    console.log('2️⃣ Creating payment record...');
    const payment = await prisma.payments.create({
      data: {
        counteragent_uuid: 'B4968862-3843-414D-9E73-1A7611618B41',
        project_uuid: 'CFFC1C06-B78B-45A0-8A02-37A23706EAFC',
        financial_code_uuid: 'B59170EC-16CC-499A-9FF7-0428DCB8F727',
        currency_uuid: gelCurrency.uuid,
        income_tax: false,
        payment_id: paymentId,
        record_uuid: '',
        insider_uuid: insiderUuid,
        is_active: true,
      },
      select: {
        payment_id: true,
        id: true,
        created_at: true,
      }
    });

    console.log(`   ✓ Payment created`);
    console.log(`   ├─ Payment ID: ${payment.payment_id}`);
    console.log(`   ├─ Payment DB ID: ${payment.id}`);
    console.log(`   └─ Created at: ${payment.created_at}\n`);

    // Step 3: Create ledger entry
    console.log('3️⃣ Creating ledger entry...');
    const ledgerEntry = await prisma.payments_ledger.create({
      data: {
        payment_id: payment.payment_id,
        effective_date: new Date('2019-11-05'),
        accrual: 100578.80, // GEL amount as accrual
        comment: 'ავანსი ლიფტების შესასყიდად',
        user_email: 'system@import',
        insider_uuid: insiderUuid,
      },
      select: {
        id: true,
        payment_id: true,
        effective_date: true,
        accrual: true,
        comment: true,
        created_at: true,
      }
    });

    console.log(`   ✓ Ledger entry created`);
    console.log(`   ├─ Ledger ID: ${ledgerEntry.id}`);
    console.log(`   ├─ Date: ${ledgerEntry.effective_date.toLocaleDateString('ka-GE')}`);
    console.log(`   ├─ Amount: 100,578.80 GEL`);
    console.log(`   └─ Created at: ${ledgerEntry.created_at}\n`);

    // Summary
    console.log('✅ SUCCESS - Record imported!\n');
    console.log('━'.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('━'.repeat(60));
    console.log(`Payment ID:         ${payment.payment_id}`);
    console.log(`Counteragent:       B4968862-3843-414D-9E73-1A7611618B41`);
    console.log(`Project:            CFFC1C06-B78B-45A0-8A02-37A23706EAFC`);
    console.log(`Financial Code:     B59170EC-16CC-499A-9FF7-0428DCB8F727`);
    console.log(`Currency:           GEL (${gelCurrency.uuid})`);
    console.log(`Amount:             100,578.80 GEL`);
    console.log(`Date:               05.11.2019`);
    console.log(`Income Tax:         No`);
    console.log(`Purpose:            Payment for lift procurement`);
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importRecord();
