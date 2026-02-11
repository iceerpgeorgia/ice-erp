import { prisma } from '../lib/prisma';

const PAYMENT_ID_REGEX = /^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$/i;

const generateCandidate = async (): Promise<string> => {
  const rows = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
    "SELECT lower(substring(md5(random()::text),1,6) || '_' || substring(md5(random()::text),1,2) || '_' || substring(md5(random()::text),1,6)) as payment_id"
  );
  return rows[0]?.payment_id ?? '';
};

const generateUniquePaymentId = async (): Promise<string> => {
  for (;;) {
    const candidate = await generateCandidate();
    if (!candidate) continue;
    const existing = await prisma.$queryRawUnsafe<Array<{ payment_id: string }>>(
      'SELECT payment_id FROM payments WHERE payment_id = $1 LIMIT 1',
      candidate
    );
    if (existing.length === 0) return candidate;
  }
};

const run = async () => {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE payments_ledger DROP CONSTRAINT IF EXISTS fk_payment_ledger_payment'
  );
  await prisma.$executeRawUnsafe(
    'ALTER TABLE payments_ledger ADD CONSTRAINT fk_payment_ledger_payment FOREIGN KEY (payment_id) REFERENCES payments(payment_id) ON DELETE CASCADE ON UPDATE CASCADE'
  );

  const invalidPayments = await prisma.$queryRawUnsafe<
    Array<{ id: bigint; payment_id: string }>
  >(
    "SELECT id, payment_id FROM payments WHERE payment_id IS NOT NULL AND payment_id !~ '^[0-9a-f]{6}_[0-9a-f]{2}_[0-9a-f]{6}$'"
  );

  if (invalidPayments.length === 0) {
    console.log('No invalid payment_id values found.');
    return;
  }

  console.log(`Found ${invalidPayments.length} invalid payment_id values.`);

  for (const payment of invalidPayments) {
    const oldPaymentId = payment.payment_id;
    if (!oldPaymentId || PAYMENT_ID_REGEX.test(oldPaymentId)) {
      continue;
    }

    const newPaymentId = await generateUniquePaymentId();

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        'UPDATE payments SET payment_id = $1, updated_at = NOW() WHERE id = $2',
        newPaymentId,
        payment.id
      ),
      prisma.$executeRawUnsafe(
        'UPDATE consolidated_bank_accounts SET payment_id = $1 WHERE payment_id = $2',
        newPaymentId,
        oldPaymentId
      ),
      prisma.$executeRawUnsafe(
        'UPDATE bank_transaction_batches SET payment_id = $1 WHERE payment_id = $2',
        newPaymentId,
        oldPaymentId
      ),
      prisma.$executeRawUnsafe(
        'UPDATE "GE78BG0000000893486000_BOG_GEL" SET payment_id = $1 WHERE payment_id = $2',
        newPaymentId,
        oldPaymentId
      ),
      prisma.$executeRawUnsafe(
        'UPDATE "GE65TB7856036050100002_TBC_GEL" SET payment_id = $1 WHERE payment_id = $2',
        newPaymentId,
        oldPaymentId
      ),
      prisma.$executeRawUnsafe(
        'UPDATE salary_accruals SET payment_id = $1 WHERE payment_id = $2',
        newPaymentId,
        oldPaymentId
      ),
    ]);

    console.log(`${oldPaymentId} -> ${newPaymentId}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
