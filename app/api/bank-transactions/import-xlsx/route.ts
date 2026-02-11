import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from '@/lib/bank-import/db-utils';
import {
  processSingleRecord,
  computeCaseDescription,
  calculateNominalAmount,
} from '@/lib/bank-import/import_bank_xml_data';
import type { ProcessingStats } from '@/lib/bank-import/types';

const SOURCE_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

type ImportRow = {
  id1: string;
  id2: string;
  paymentId: string;
  accountCurrencyAmount?: number | null;
  nominalAmount?: number | null;
  nominalCurrencyCode?: string | null;
};

type PreviewRow = {
  id1: string;
  id2: string;
  paymentId: string;
  sourceTable: string | null;
  rawRecordUuid: string | null;
  transactionDate: string | null;
  accountCurrencyAmount: number | null;
  currentPaymentId: string | null;
  newPaymentId: string | null;
  processingCase: string | null;
  appliedRuleId: number | null;
  counteragentName?: string | null;
  projectIndex?: string | null;
  financialCode?: string | null;
  nominalCurrencyCode?: string | null;
  warnings: string[];
  status: 'ok' | 'missing-record' | 'invalid';
  batchKey: string;
  counteragentUuid: string | null;
  counteragentAccountNumber: string | null;
  projectUuid: string | null;
  financialCodeUuid: string | null;
  nominalCurrencyUuid: string | null;
  nominalAmount: number | null;
  bankAccountUuid: string | null;
};

const formatBatchId = (uuid: string) => {
  const compact = uuid.replace(/-/g, '').toUpperCase();
  const part1 = compact.slice(0, 6);
  const part2 = compact.slice(6, 8);
  const part3 = compact.slice(8, 14);
  return `BTC_${part1}_${part2}_${part3}`;
};

const safeNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(num) ? null : num;
};

const parseDateValue = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  if (str.includes('.')) {
    const [day, month, year] = str.split('.');
    if (!day || !month || !year) return null;
    const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (str.includes('-')) {
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getRecordByIds = async (id1: string, id2: string) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM (
        SELECT
          '${SOURCE_TABLES[0]}' as source_table,
          dockey,
          entriesid,
          raw_record_uuid,
          bank_account_uuid,
          account_currency_uuid,
          account_currency_amount,
          transaction_date,
          correction_date,
          description,
          docinformation,
          docnomination,
          docsenderinn,
          docbenefinn,
          doccoracct,
          docsenderacctno,
          docbenefacctno,
          docprodgroup,
          entrydbamt,
          entrycramt,
          counteragent_account_number,
          payment_id
        FROM "${SOURCE_TABLES[0]}"
        WHERE dockey = $1 AND entriesid = $2
        UNION ALL
        SELECT
          '${SOURCE_TABLES[1]}' as source_table,
          dockey,
          entriesid,
          raw_record_uuid,
          bank_account_uuid,
          account_currency_uuid,
          account_currency_amount,
          transaction_date,
          correction_date,
          description,
          docinformation,
          docnomination,
          docsenderinn,
          docbenefinn,
          doccoracct,
          docsenderacctno,
          docbenefacctno,
          docprodgroup,
          entrydbamt,
          entrycramt,
          counteragent_account_number,
          payment_id
        FROM "${SOURCE_TABLES[1]}"
        WHERE dockey = $1 AND entriesid = $2
      ) as records
      LIMIT 1`,
    id1,
    id2
  );

  return rows?.[0] ?? null;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mode = body?.mode === 'apply' ? 'apply' : 'preview';
    const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const invalidRows = rows.filter(
      (row) => !row?.id1 || !row?.id2 || !row?.paymentId
    );
    if (invalidRows.length > 0) {
      return NextResponse.json(
        { error: 'ID1, ID2, and Payment ID are required for all rows' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] =
      await Promise.all([
        loadCounteragents(supabase),
        loadParsingRules(supabase),
        loadPayments(supabase),
        loadNBGRates(supabase),
        loadCurrencyCache(supabase),
      ]);

    const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

    const paymentIdentifiers = Array.from(
      new Set(rows.map((row) => row.paymentId?.trim()).filter(Boolean))
    ) as string[];

    const paymentUuidRows = paymentIdentifiers.length
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT payment_id, record_uuid FROM payments WHERE payment_id = ANY($1::text[]) OR record_uuid::text = ANY($1::text[])`,
          paymentIdentifiers
        )
      : [];

    const paymentUuidMap = new Map<string, string>();
    const paymentRecordUuidMap = new Map<string, string>();
    paymentUuidRows.forEach((row) => {
      if (row?.payment_id && row?.record_uuid) {
        paymentUuidMap.set(String(row.payment_id), String(row.record_uuid));
        paymentRecordUuidMap.set(String(row.record_uuid), String(row.payment_id));
      }
    });

    let previewRows: PreviewRow[] = [];

    for (const row of rows) {
      const warnings: string[] = [];
      const matched = await getRecordByIds(row.id1, row.id2);
      if (!matched) {
        previewRows.push({
          id1: row.id1,
          id2: row.id2,
          paymentId: row.paymentId,
          sourceTable: null,
          rawRecordUuid: null,
          transactionDate: null,
          accountCurrencyAmount: null,
          currentPaymentId: null,
          newPaymentId: null,
          processingCase: null,
          appliedRuleId: null,
          warnings: ['Record not found for ID1/ID2'],
          status: 'missing-record',
          batchKey: `${row.id1}__${row.id2}`,
          counteragentUuid: null,
          counteragentAccountNumber: null,
          projectUuid: null,
          financialCodeUuid: null,
          nominalCurrencyUuid: null,
          nominalAmount: null,
          bankAccountUuid: null,
        });
        continue;
      }

      const debit = safeNumber(matched.entrydbamt) || 0;
      const transactionDate = parseDateValue(matched.transaction_date);
      const correctionDate = parseDateValue(matched.correction_date);
      const effectiveDate = correctionDate || transactionDate;

      const rowForProcessing = {
        dockey: matched.dockey,
        entriesid: matched.entriesid,
        docsenderinn: matched.docsenderinn,
        docbenefinn: matched.docbenefinn,
        doccorracct: matched.doccorracct,
        docsenderacctno: matched.docsenderacctno,
        docbenefacctno: matched.docbenefacctno,
        docprodgroup: matched.docprodgroup,
        docnomination: matched.docnomination,
        docinformation: matched.docinformation,
        debit,
      };

      const stats: ProcessingStats = {
        case1_counteragent_processed: 0,
        case2_counteragent_inn_blank: 0,
        case3_counteragent_inn_nonblank_no_match: 0,
        case4_payment_id_match: 0,
        case5_payment_id_counteragent_mismatch: 0,
        case6_parsing_rule_match: 0,
        case7_parsing_rule_counteragent_mismatch: 0,
        case8_parsing_rule_dominance: 0,
      };

      const resolvedPaymentId = paymentRecordUuidMap.get(row.paymentId) || row.paymentId;

      const result = processSingleRecord(
        rowForProcessing,
        counteragentsMap,
        parsingRules,
        paymentsMap,
        salaryBaseMap,
        salaryLatestMap,
        duplicatePaymentMap,
        1,
        stats,
        new Map(),
        () => resolvedPaymentId
      );

      const case2 = !result.counteragent_inn;
      const processingCase = computeCaseDescription(
        result.case1_counteragent_processed,
        case2,
        result.case3_counteragent_missing,
        result.case4_payment_id_matched,
        result.case5_payment_id_conflict,
        result.case6_parsing_rule_applied,
        result.case7_parsing_rule_conflict,
        false,
        result.applied_rule_id
      );

      const providedAmount = safeNumber(row.accountCurrencyAmount);
      const accountCurrencyAmount =
        providedAmount !== null && providedAmount !== undefined
          ? providedAmount
          : safeNumber(matched.account_currency_amount) ?? 0;

      const nominalCurrencyUuid = result.nominal_currency_uuid || matched.account_currency_uuid;
      const accountCurrencyCode = currencyCache.get(matched.account_currency_uuid) || 'GEL';
      const nominalCurrencyCode = nominalCurrencyUuid ? currencyCache.get(nominalCurrencyUuid) || 'GEL' : null;
      const calculatedNominalAmount =
        effectiveDate && nominalCurrencyUuid
          ? calculateNominalAmount(
              Number(accountCurrencyAmount || 0),
              accountCurrencyCode,
              nominalCurrencyUuid,
              effectiveDate,
              nbgRatesMap,
              currencyCache
            )
          : null;

      const providedNominal = safeNumber(row.nominalAmount);
      const shouldUseProvidedNominal =
        providedNominal !== null &&
        providedNominal !== undefined &&
        (!!nominalCurrencyCode && nominalCurrencyCode === accountCurrencyCode);
      const nominalAmount = shouldUseProvidedNominal
        ? providedNominal
        : calculatedNominalAmount;

      console.log('[import-xlsx] nominal calc', {
        id1: row.id1,
        id2: row.id2,
        paymentId: row.paymentId,
        resolvedPaymentId: result.payment_id,
        accountCurrencyAmount,
        accountCurrencyUuid: matched.account_currency_uuid,
        accountCurrencyCode,
        nominalCurrencyUuid,
        nominalCurrencyCode,
        transactionDate: matched.transaction_date || null,
        correctionDate: matched.correction_date || null,
        effectiveDate: effectiveDate ? effectiveDate.toISOString() : null,
        providedNominal,
        calculatedNominalAmount,
        nominalAmount,
      });

      if (!result.payment_id) {
        warnings.push('Payment ID not matched by rules or dictionaries');
      }

      if (result.case5_payment_id_conflict) {
        warnings.push('Payment ID conflicts with Phase 1/2 counteragent; kept original');
      }

      previewRows.push({
        id1: row.id1,
        id2: row.id2,
        paymentId: resolvedPaymentId,
        sourceTable: matched.source_table,
        rawRecordUuid: matched.raw_record_uuid,
        transactionDate: matched.transaction_date || null,
        accountCurrencyAmount: accountCurrencyAmount ?? null,
        currentPaymentId: matched.payment_id ?? null,
        newPaymentId: result.payment_id,
        processingCase: processingCase || null,
        appliedRuleId: result.applied_rule_id,
        warnings,
        status: 'ok',
        batchKey: `${row.id1}__${row.id2}`,
        counteragentUuid: result.counteragent_uuid,
        counteragentAccountNumber: result.counteragent_account_number,
        projectUuid: result.project_uuid,
        financialCodeUuid: result.financial_code_uuid,
        nominalCurrencyUuid,
        nominalAmount: nominalAmount ?? null,
        bankAccountUuid: matched.bank_account_uuid ?? null,
      });
    }

    const counteragentIds = Array.from(
      new Set(previewRows.map((row) => row.counteragentUuid).filter(Boolean))
    ) as string[];
    const projectIds = Array.from(
      new Set(previewRows.map((row) => row.projectUuid).filter(Boolean))
    ) as string[];
    const financialCodeIds = Array.from(
      new Set(previewRows.map((row) => row.financialCodeUuid).filter(Boolean))
    ) as string[];

    const [counteragentRows, projectRows, financialCodeRows] = await Promise.all([
      counteragentIds.length
        ? prisma.$queryRawUnsafe<any[]>(
            `SELECT counteragent_uuid, counteragent FROM counteragents WHERE counteragent_uuid = ANY($1::uuid[])`,
            counteragentIds
          )
        : [],
      projectIds.length
        ? prisma.$queryRawUnsafe<any[]>(
            `SELECT project_uuid, project_index FROM projects WHERE project_uuid = ANY($1::uuid[])`,
            projectIds
          )
        : [],
      financialCodeIds.length
        ? prisma.$queryRawUnsafe<any[]>(
            `SELECT uuid, validation FROM financial_codes WHERE uuid = ANY($1::uuid[])`,
            financialCodeIds
          )
        : [],
    ]);

    const counteragentMap = new Map(
      counteragentRows.map((row) => [String(row.counteragent_uuid), row.counteragent])
    );
    const projectMap = new Map(
      projectRows.map((row) => [String(row.project_uuid), row.project_index])
    );
    const financialCodeMap = new Map(
      financialCodeRows.map((row) => [String(row.uuid), row.validation])
    );

    previewRows = previewRows.map((row) => ({
      ...row,
      counteragentName: row.counteragentUuid ? counteragentMap.get(row.counteragentUuid) ?? null : null,
      projectIndex: row.projectUuid ? projectMap.get(row.projectUuid) ?? null : null,
      financialCode: row.financialCodeUuid ? financialCodeMap.get(row.financialCodeUuid) ?? null : null,
      nominalCurrencyCode: row.nominalCurrencyUuid
        ? currencyCache.get(row.nominalCurrencyUuid) ?? null
        : null,
    }));

    const grouped = previewRows.reduce((acc, row) => {
      if (!acc[row.batchKey]) acc[row.batchKey] = [];
      acc[row.batchKey].push(row);
      return acc;
    }, {} as Record<string, PreviewRow[]>);

    const summary = {
      total: previewRows.length,
      missingRecords: previewRows.filter((row) => row.status === 'missing-record').length,
      batchGroups: Object.values(grouped).filter((group) => group.length > 1).length,
    };

    if (mode === 'preview') {
      return NextResponse.json({ summary, rows: previewRows });
    }

    let updated = 0;
    let batchesCreated = 0;
    const errors: string[] = [];

    for (const group of Object.values(grouped)) {
      const groupKey = group[0]?.batchKey;
      if (!groupKey) continue;

      const validGroup = group.filter((row) => row.status === 'ok' && row.rawRecordUuid);
      if (validGroup.length !== group.length) {
        errors.push(`Skipping ${groupKey}: some rows are missing records.`);
        continue;
      }

      const base = validGroup[0];
      if (!base.sourceTable || !base.rawRecordUuid) {
        errors.push(`Skipping ${groupKey}: missing source table info.`);
        continue;
      }

      if (!base.bankAccountUuid) {
        errors.push(`Skipping ${groupKey}: missing bank account UUID.`);
        continue;
      }

      await prisma.$executeRawUnsafe(
        `DELETE FROM bank_transaction_batches WHERE raw_record_uuid::text = $1::text`,
        base.rawRecordUuid
      );

      if (validGroup.length > 1) {
        const hasMissingAmount = validGroup.some(
          (row) => row.accountCurrencyAmount === null || row.accountCurrencyAmount === undefined
        );
        if (hasMissingAmount) {
          errors.push(`Skipping ${groupKey}: batch partitions require Amount values.`);
          continue;
        }

        const hasMissingPayment = validGroup.some((row) => !row.newPaymentId);
        if (hasMissingPayment) {
          errors.push(`Skipping ${groupKey}: batch partitions require resolvable Payment IDs.`);
          continue;
        }

        const batchUuidRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT gen_random_uuid()::text as uuid`
        );
        const batchUuid = batchUuidRows[0].uuid;
        const batchId = formatBatchId(batchUuid);

        const insertPromises = validGroup.map((row, index) => {
          const partitionAmount = Math.abs(Number(row.accountCurrencyAmount || 0));
          const nominalAmount =
            row.nominalAmount !== null && row.nominalAmount !== undefined
              ? Math.abs(Number(row.nominalAmount))
              : null;
          const paymentUuid = row.newPaymentId ? paymentUuidMap.get(row.newPaymentId) : null;

          return prisma.$queryRawUnsafe(
            `
            INSERT INTO bank_transaction_batches (
              bank_account_uuid,
              raw_record_id_1,
              raw_record_id_2,
              raw_record_uuid,
              batch_id,
              batch_uuid,
              partition_amount,
              partition_sequence,
              payment_uuid,
              payment_id,
              counteragent_uuid,
              project_uuid,
              financial_code_uuid,
              nominal_currency_uuid,
              nominal_amount,
              partition_note
            ) VALUES (
              $1::uuid,
              $2,
              $3,
              $4,
              $5,
              $6::uuid,
              $7,
              $8,
              $9::uuid,
              $10,
              $11::uuid,
              $12::uuid,
              $13::uuid,
              $14::uuid,
              $15,
              NULL
            )
          `,
            base.bankAccountUuid,
            row.id1,
            row.id2,
            base.rawRecordUuid,
            batchId,
            batchUuid,
            partitionAmount,
            index + 1,
            paymentUuid,
            row.newPaymentId,
            row.counteragentUuid,
            row.projectUuid,
            row.financialCodeUuid,
            row.nominalCurrencyUuid,
            nominalAmount
          );
        });

        await Promise.all(insertPromises);

        await Promise.all(
          SOURCE_TABLES.map((table) =>
            prisma.$executeRawUnsafe(
              `UPDATE "${table}" SET parsing_lock = true, payment_id = $1, updated_at = NOW() WHERE raw_record_uuid::text = $2::text`,
              batchId,
              base.rawRecordUuid
            )
          )
        );

        batchesCreated += 1;
        continue;
      }

      const row = validGroup[0];
      if (!row.newPaymentId) {
        errors.push(`Skipping ${groupKey}: Payment ID not resolved.`);
        continue;
      }

      const updateParams = [
        row.counteragentUuid,
        row.counteragentAccountNumber,
        row.projectUuid,
        row.financialCodeUuid,
        row.nominalCurrencyUuid,
        row.nominalAmount,
        row.newPaymentId,
        row.processingCase,
        row.appliedRuleId,
        row.id1,
        row.id2,
      ];

      await prisma.$executeRawUnsafe(
        `UPDATE "${row.sourceTable}"
         SET
           counteragent_uuid = $1::uuid,
           counteragent_account_number = $2,
           project_uuid = $3::uuid,
           financial_code_uuid = $4::uuid,
           nominal_currency_uuid = $5::uuid,
           nominal_amount = $6,
           payment_id = $7,
           processing_case = $8,
           applied_rule_id = $9,
           updated_at = NOW()
         WHERE dockey = $10 AND entriesid = $11`,
        ...updateParams
      );

      updated += 1;
    }

    return NextResponse.json({ updated, batchesCreated, errors });
  } catch (error: any) {
    console.error('[import-xlsx] error', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to import XLSX' },
      { status: 500 }
    );
  }
}
