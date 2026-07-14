const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function importBankTransaction() {
  try {
    console.log('🔄 Importing bank transaction record to GE65TB7856036050100002_TBC_GEL...\n');

    // Step 1: Get GEL currency UUID
    console.log('1️⃣ Fetching GEL currency UUID...');
    const gelCurrency = await prisma.$queryRawUnsafe(`
      SELECT uuid FROM currencies WHERE code = 'GEL' LIMIT 1
    `);
    if (!gelCurrency || gelCurrency.length === 0) {
      throw new Error('GEL currency not found');
    }
    const gelUuid = gelCurrency[0].uuid;
    console.log(`   ✓ GEL UUID: ${gelUuid}\n`);

    // Step 2: Get bank account UUID
    console.log('2️⃣ Fetching bank account UUID...');
    const bankAccount = await prisma.$queryRawUnsafe(`
      SELECT uuid FROM bank_accounts 
      WHERE account_number = 'GE65TB7856036050100002' 
      LIMIT 1
    `);
    if (!bankAccount || bankAccount.length === 0) {
      throw new Error('Bank account not found');
    }
    const bankAccountUuid = bankAccount[0].uuid;
    console.log(`   ✓ Bank Account UUID: ${bankAccountUuid}\n`);

    // Step 3: Generate UUID for raw record
    console.log('3️⃣ Generating UUIDs...');
    const uuidResult = await prisma.$queryRawUnsafe(`
      SELECT gen_random_uuid() as uuid1, gen_random_uuid() as uuid2
    `);
    const transactionUuid = uuidResult[0].uuid1;
    const rawRecordUuid = uuidResult[0].uuid2;
    console.log(`   ✓ Transaction UUID: ${transactionUuid}`);
    console.log(`   ✓ Raw Record UUID: ${rawRecordUuid}\n`);

    // Step 4: Insert bank transaction
    console.log('4️⃣ Inserting bank transaction record...');
    const now = new Date();
    
    const result = await prisma.$executeRawUnsafe(`
      INSERT INTO "GE65TB7856036050100002_TBC_GEL" (
        uuid,
        import_date,
        is_processed,
        created_at,
        updated_at,
        bank_account_uuid,
        raw_record_uuid,
        transaction_date,
        account_currency_uuid,
        account_currency_amount,
        nominal_currency_uuid,
        nominal_amount,
        counteragent_uuid,
        payment_id,
        docnomination,
        docsenderinn,
        docbenefinn,
        doccomment,
        counteragent_processed,
        parsing_rule_processed,
        payment_id_processed,
        counteragent_inn
      ) VALUES (
        '${transactionUuid}'::uuid,
        NOW(),
        false,
        NOW(),
        NOW(),
        '${bankAccountUuid}'::uuid,
        '${rawRecordUuid}'::uuid,
        '2019-11-05',
        '${gelUuid}'::uuid,
        100578.80,
        '${gelUuid}'::uuid,
        100578.80,
        'b4968862-3843-414d-9e73-1a7611618b41'::uuid,
        '',
        'ავანსი ლიფტების შესასყიდად სრ.თანხის 10% 34000 2.9582 ერ კურსით',
        NULL,
        NULL,
        NULL,
        false,
        false,
        false,
        NULL
      )
    `);

    console.log(`   ✓ Record inserted\n`);

    // Step 5: Verify the record
    console.log('5️⃣ Verifying record...');
    const record = await prisma.$queryRawUnsafe(`
      SELECT 
        uuid,
        raw_record_uuid,
        transaction_date,
        account_currency_amount,
        nominal_amount,
        docnomination,
        counteragent_uuid,
        payment_id
      FROM "GE65TB7856036050100002_TBC_GEL"
      WHERE uuid = '${transactionUuid}'::uuid
    `);

    if (record && record.length > 0) {
      const r = record[0];
      console.log(`   ✓ Record verified\n`);
      
      console.log('━'.repeat(80));
      console.log('✅ BANK TRANSACTION RECORD IMPORTED SUCCESSFULLY');
      console.log('━'.repeat(80));
      console.log(`Bank Account:     GE65TB7856036050100002`);
      console.log(`Transaction UUID: ${r.uuid}`);
      console.log(`Raw Record UUID:  ${r.raw_record_uuid}`);
      console.log(`Date:             ${r.transaction_date}`);
      console.log(`Amount (GEL):     ${r.account_currency_amount}`);
      console.log(`Nominal (GEL):    ${r.nominal_amount}`);
      console.log(`Counteragent:     ${r.counteragent_uuid}`);
      console.log(`Document:         ${r.docnomination}`);
      console.log('━'.repeat(80));
    } else {
      console.log('❌ Record verification failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

importBankTransaction();
