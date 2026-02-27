import { NextRequest, NextResponse } from 'next/server';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const revalidate = 0;

const DECONSOLIDATED_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
] as const;

const normalizePaymentKey = (value: string) => {
  const trimmed = value.trim();
  const base = trimmed.includes(':') ? trimmed.split(':')[0] : trimmed;
  return base.toLowerCase();
};

async function remapPaymentIdBindings(oldPaymentId: string, newPaymentId: string) {
  if (!oldPaymentId || !newPaymentId) return;
  if (oldPaymentId.trim().toLowerCase() === newPaymentId.trim().toLowerCase()) return;

  for (const tableName of DECONSOLIDATED_TABLES) {
    await prisma.$executeRawUnsafe(
      `
        UPDATE "${tableName}"
        SET payment_id = $1,
            updated_at = NOW()
        WHERE lower(trim(payment_id)) = lower(trim($2))
      `,
      newPaymentId,
      oldPaymentId
    );
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE bank_transaction_batches
      SET payment_id = $1,
          updated_at = NOW()
      WHERE payment_id IS NOT NULL
        AND lower(trim(payment_id)) = lower(trim($2))
    `,
    newPaymentId,
    oldPaymentId
  );
}

// Helper function to generate payment_id
function generatePaymentId(counteragentUuid: string, financial_code_uuid: string, salaryMonth: Date): string {
  // Extract characters at positions 2, 4, 6, 8, 10, 12 (1-indexed Excel MID)
  // This corresponds to indices 1, 3, 5, 7, 9, 11 (0-indexed) from UUID WITH hyphens
  const extractChars = (uuid: string) => {
    // Excel MID works on UUID WITH hyphens, so we DON'T remove them
    return uuid[1] + uuid[3] + uuid[5] + uuid[7] + uuid[9] + uuid[11];
  };
  
  const counteragentPart = extractChars(counteragentUuid);
  const financialPart = extractChars(financial_code_uuid);
  
  const month = salaryMonth.getMonth() + 1;
  const year = salaryMonth.getFullYear();
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  
  return `NP_${counteragentPart}_NJ_${financialPart}_PRL${monthStr}${year}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (id) {
      // Fetch single record
      const accrual = await prisma.salary_accruals.findUnique({
        where: { id: BigInt(id) },
      });

      if (!accrual) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      // Fetch related data
      const [counteragent, financial_code, currency] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT counteragent_uuid, counteragent FROM counteragents WHERE counteragent_uuid = ${accrual.counteragent_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, validation FROM financial_codes WHERE uuid = ${accrual.financial_code_uuid}::uuid LIMIT 1
        `,
        prisma.$queryRaw<any[]>`
          SELECT uuid, code FROM currencies WHERE uuid = ${accrual.nominal_currency_uuid}::uuid LIMIT 1
        `,
      ]);

      return NextResponse.json({
        ...accrual,
        id: accrual.id.toString(),
        counteragent_name: counteragent[0]?.counteragent || 'Unknown',
        counteragent_iban: counteragent[0]?.iban || null,
        financial_code: financial_code[0]?.validation || 'Unknown',
        currency_code: currency[0]?.code || 'Unknown',
        net_sum: accrual.net_sum.toString(),
        surplus_insurance: accrual.surplus_insurance?.toString() || null,
        deducted_insurance: accrual.deducted_insurance?.toString() || null,
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      });
    }

    // Fetch all records with related data
    const accruals = await prisma.$queryRaw<any[]>`
      SELECT 
        sa.id,
        sa.uuid,
        sa.counteragent_uuid,
        sa.financial_code_uuid,
        sa.nominal_currency_uuid,
        sa.payment_id,
        sa.salary_month,
        sa.net_sum,
        sa.surplus_insurance,
        sa.deducted_insurance,
        sa.deducted_fitness,
        sa.deducted_fine,
        sa.created_at,
        sa.updated_at,
        c.counteragent as counteragent_name,
        c.identification_number,
        c.sex,
        c.pension_scheme,
        c.iban as counteragent_iban,
        fc.validation as financial_code,
        cur.code as currency_code
      FROM salary_accruals sa
      LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
      LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
      LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
      ORDER BY sa.salary_month DESC, sa.created_at DESC
    `;

    const paidRows = await prisma.$queryRaw<any[]>`
      SELECT
        lower(trim(split_part(payment_id, ':', 1))) as payment_id_key,
        counteragent_uuid,
        nominal_currency_uuid,
        ABS(SUM(nominal_amount))::numeric as paid
      FROM (
        SELECT
          cba.payment_id,
          cba.counteragent_uuid,
          cba.nominal_currency_uuid,
          cba.nominal_amount
        FROM "GE78BG0000000893486000_BOG_GEL" cba
        WHERE NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
        )
        AND cba.payment_id NOT ILIKE 'BTC_%'
        UNION ALL
        SELECT
          t.payment_id,
          t.counteragent_uuid,
          t.nominal_currency_uuid,
          t.nominal_amount
        FROM "GE65TB7856036050100002_TBC_GEL" t
        WHERE NOT EXISTS (
          SELECT 1 FROM bank_transaction_batches btb
          WHERE btb.raw_record_uuid::text = t.raw_record_uuid::text
        )
        AND t.payment_id NOT ILIKE 'BTC_%'
        UNION ALL
        SELECT
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          ) as payment_id,
          COALESCE(btb.counteragent_uuid, p.counteragent_uuid, cba.counteragent_uuid) as counteragent_uuid,
          COALESCE(btb.nominal_currency_uuid, p.currency_uuid, cba.nominal_currency_uuid) as nominal_currency_uuid,
          (COALESCE(btb.nominal_amount, btb.partition_amount) * CASE WHEN cba.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount
        FROM "GE78BG0000000893486000_BOG_GEL" cba
        JOIN bank_transaction_batches btb
          ON btb.raw_record_uuid::text = cba.raw_record_uuid::text
        LEFT JOIN payments p
          ON (
            btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
          ) OR (
            btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
          )
        UNION ALL
        SELECT
          COALESCE(
            CASE WHEN btb.payment_id ILIKE 'BTC_%' THEN NULL ELSE btb.payment_id END,
            p.payment_id
          ) as payment_id,
          COALESCE(btb.counteragent_uuid, p.counteragent_uuid, t.counteragent_uuid) as counteragent_uuid,
          COALESCE(btb.nominal_currency_uuid, p.currency_uuid, t.nominal_currency_uuid) as nominal_currency_uuid,
          (COALESCE(btb.nominal_amount, btb.partition_amount) * CASE WHEN t.account_currency_amount < 0 THEN -1 ELSE 1 END) as nominal_amount
        FROM "GE65TB7856036050100002_TBC_GEL" t
        JOIN bank_transaction_batches btb
          ON btb.raw_record_uuid::text = t.raw_record_uuid::text
        LEFT JOIN payments p
          ON (
            btb.payment_uuid IS NOT NULL AND p.record_uuid = btb.payment_uuid
          ) OR (
            btb.payment_uuid IS NULL AND btb.payment_id IS NOT NULL AND p.payment_id = btb.payment_id
          )
      ) tx
      WHERE payment_id IS NOT NULL AND payment_id <> ''
      GROUP BY lower(trim(split_part(payment_id, ':', 1))), counteragent_uuid, nominal_currency_uuid
    `;

    const paidMap = new Map<string, number>();
    const paidByPayment = new Map<string, number>();
    const currencySetMap = new Map<string, Set<string>>();
    for (const row of paidRows) {
      const paymentKey = String(row.payment_id_key || '').trim();
      if (!paymentKey) continue;
      const counteragentKey = row.counteragent_uuid ? String(row.counteragent_uuid) : '';
      const currencyKey = row.nominal_currency_uuid ? String(row.nominal_currency_uuid) : '';
      const amount = row.paid ? Number(row.paid) : 0;
      const compositeKey = `${paymentKey}|${counteragentKey}`;
      paidMap.set(`${compositeKey}|${currencyKey}`, amount);
      paidByPayment.set(compositeKey, (paidByPayment.get(compositeKey) || 0) + amount);
      if (!currencySetMap.has(compositeKey)) {
        currencySetMap.set(compositeKey, new Set());
      }
      currencySetMap.get(compositeKey)!.add(currencyKey);
    }

    const formattedAccruals = accruals.map((accrual) => {
      const paymentKey = normalizePaymentKey(String(accrual.payment_id || ''));
      const counteragentKey = accrual.counteragent_uuid ? String(accrual.counteragent_uuid) : '';
      const compositeKey = `${paymentKey}|${counteragentKey}`;
      const currencyKey = accrual.nominal_currency_uuid ? String(accrual.nominal_currency_uuid) : '';
      const paidByCurrencyKey = `${compositeKey}|${currencyKey}`;
      const hasCurrencyMatch = paidMap.has(paidByCurrencyKey);
      let paid = hasCurrencyMatch ? paidMap.get(paidByCurrencyKey) || 0 : 0;
      if (!hasCurrencyMatch) {
        const currencySet = currencySetMap.get(compositeKey);
        if (currencySet && currencySet.size <= 1) {
          paid = paidByPayment.get(compositeKey) || 0;
        }
      }
      return {
        paid,
        ...accrual,
      id: accrual.id.toString(),
      net_sum: accrual.net_sum.toString(),
      surplus_insurance: accrual.surplus_insurance?.toString() || null,
      deducted_insurance: accrual.deducted_insurance?.toString() || null,
      deducted_fitness: accrual.deducted_fitness?.toString() || null,
      deducted_fine: accrual.deducted_fine?.toString() || null,
      };
    });

    return NextResponse.json(formattedAccruals);
  } catch (error: any) {
    console.error('Error fetching salary accruals:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body?.action === 'copy-latest') {
      const { base_month, target_month, created_by } = body;
      if (!base_month || !target_month) {
        return NextResponse.json({ error: 'Missing base_month or target_month' }, { status: 400 });
      }

      const baseStart = new Date(base_month);
      const targetDate = new Date(target_month);
      if (Number.isNaN(baseStart.getTime()) || Number.isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'Invalid base_month or target_month' }, { status: 400 });
      }

      const baseEnd = new Date(baseStart.getFullYear(), baseStart.getMonth() + 1, 1);
      const baseRecords = await prisma.salary_accruals.findMany({
        where: { salary_month: { gte: baseStart, lt: baseEnd } },
      });

      if (baseRecords.length === 0) {
        return NextResponse.json({ inserted: 0, base_count: 0, records: [] });
      }

      const createdIds: bigint[] = [];
      for (const record of baseRecords) {
        const created = await prisma.salary_accruals.create({
          data: {
            counteragent_uuid: record.counteragent_uuid,
            financial_code_uuid: record.financial_code_uuid,
            nominal_currency_uuid: record.nominal_currency_uuid,
            payment_id: generatePaymentId(record.counteragent_uuid, record.financial_code_uuid, targetDate),
            salary_month: targetDate,
            net_sum: record.net_sum,
            surplus_insurance: record.surplus_insurance,
            deducted_insurance: record.deducted_insurance,
            deducted_fitness: record.deducted_fitness,
            deducted_fine: record.deducted_fine,
            created_by: created_by || 'user',
            updated_by: created_by || 'user',
          },
        });
        createdIds.push(created.id);
      }

      const createdRecords = createdIds.length
        ? await prisma.$queryRaw<any[]>`
            SELECT 
              sa.id,
              sa.uuid,
              sa.counteragent_uuid,
              sa.financial_code_uuid,
              sa.nominal_currency_uuid,
              sa.payment_id,
              sa.salary_month,
              sa.net_sum,
              sa.surplus_insurance,
              sa.deducted_insurance,
              sa.deducted_fitness,
              sa.deducted_fine,
              sa.created_at,
              sa.updated_at,
              c.counteragent as counteragent_name,
              c.identification_number,
              c.sex,
              c.pension_scheme,
              fc.validation as financial_code,
              cur.code as currency_code
            FROM salary_accruals sa
            LEFT JOIN counteragents c ON sa.counteragent_uuid = c.counteragent_uuid
            LEFT JOIN financial_codes fc ON sa.financial_code_uuid = fc.uuid
            LEFT JOIN currencies cur ON sa.nominal_currency_uuid = cur.uuid
            WHERE sa.id IN (${Prisma.join(createdIds)})
          `
        : [];

      const formatted = createdRecords.map((accrual) => ({
        ...accrual,
        id: accrual.id.toString(),
        net_sum: accrual.net_sum.toString(),
        surplus_insurance: accrual.surplus_insurance?.toString() || null,
        deducted_insurance: accrual.deducted_insurance?.toString() || null,
        deducted_fitness: accrual.deducted_fitness?.toString() || null,
        deducted_fine: accrual.deducted_fine?.toString() || null,
      }));

      return NextResponse.json({ inserted: createdIds.length, base_count: baseRecords.length, records: formatted });
    }
    const {
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      created_by,
    } = body;

    // Validate required fields
    if (!counteragent_uuid || !financial_code_uuid || !nominal_currency_uuid || !salary_month || net_sum === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate payment_id
    const salaryDate = new Date(salary_month);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);

    // Create the accrual
    const accrual = await prisma.salary_accruals.create({
      data: {
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: surplus_insurance ? parseFloat(surplus_insurance) : null,
        deducted_insurance: deducted_insurance ? parseFloat(deducted_insurance) : null,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        created_by: created_by || 'system',
        updated_by: created_by || 'system',
      },
    });

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
      payment_id,
    });
  } catch (error: any) {
    console.error('Error creating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      counteragent_uuid,
      financial_code_uuid,
      nominal_currency_uuid,
      salary_month,
      net_sum,
      surplus_insurance,
      deducted_insurance,
      deducted_fitness,
      deducted_fine,
      updated_by,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const existing = await prisma.salary_accruals.findUnique({
      where: { id: BigInt(id) },
      select: { payment_id: true },
    });

    // Regenerate payment_id if key fields changed
    const salaryDate = new Date(salary_month);
    const payment_id = generatePaymentId(counteragent_uuid, financial_code_uuid, salaryDate);

    const accrual = await prisma.salary_accruals.update({
      where: { id: BigInt(id) },
      data: {
        counteragent_uuid,
        financial_code_uuid,
        nominal_currency_uuid,
        payment_id,
        salary_month: salaryDate,
        net_sum: parseFloat(net_sum),
        surplus_insurance: surplus_insurance ? parseFloat(surplus_insurance) : null,
        deducted_insurance: deducted_insurance ? parseFloat(deducted_insurance) : null,
        deducted_fitness: deducted_fitness ? parseFloat(deducted_fitness) : null,
        deducted_fine: deducted_fine ? parseFloat(deducted_fine) : null,
        updated_at: new Date(),
        updated_by: updated_by || 'system',
      },
    });

    const oldPaymentId = existing?.payment_id || null;
    if (oldPaymentId && payment_id) {
      await remapPaymentIdBindings(oldPaymentId, payment_id);
    }

    return NextResponse.json({
      ...accrual,
      id: accrual.id.toString(),
    });
  } catch (error: any) {
    console.error('Error updating salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.salary_accruals.delete({
      where: { id: BigInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting salary accrual:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

