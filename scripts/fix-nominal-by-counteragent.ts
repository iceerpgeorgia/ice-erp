import fs from 'fs';
import { config } from 'dotenv';
import {
  getSupabaseClient,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from '../lib/bank-import/db-utils';
import { calculateNominalAmount } from '../lib/bank-import/import_bank_xml_data_deconsolidated';

if (fs.existsSync('.env.local')) {
  config({ path: '.env.local' });
} else {
  config();
}

const DEFAULT_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const parseTablesArg = () => {
  const arg = process.argv.find((item) => item.startsWith('--tables='));
  if (!arg) return DEFAULT_TABLES;
  const value = arg.split('=')[1] || '';
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_TABLES;
};

const counteragentUuid = process.argv[2];
if (!counteragentUuid) {
  console.error('Usage: ts-node scripts/fix-nominal-by-counteragent.ts <counteragent_uuid> [--tables=TABLE1,TABLE2]');
  process.exit(1);
}

const tables = parseTablesArg();
const batchSize = Number(process.env.BATCH_SIZE ?? '500');

const toNumber = (value: any) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(num) ? null : num;
};

async function fixTable(tableName: string) {
  const supabase = getSupabaseClient();
  const [paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap } = paymentsBundle;

  let offset = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from(tableName)
      .select(
        'id,payment_id,account_currency_amount,account_currency_uuid,nominal_currency_uuid,nominal_amount,transaction_date,correction_date'
      )
      .eq('counteragent_uuid', counteragentUuid)
      .not('payment_id', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    scanned += rows.length;

    for (const row of rows) {
      const paymentId = row.payment_id ? String(row.payment_id) : null;
      const paymentData = paymentId ? paymentsMap.get(paymentId) : null;
      const paymentCurrencyUuid = paymentData?.currency_uuid || null;

      const accountCurrencyUuid = row.account_currency_uuid || null;
      const accountCurrencyCode = accountCurrencyUuid ? currencyCache.get(accountCurrencyUuid) : null;

      const nominalCurrencyUuid = paymentCurrencyUuid || row.nominal_currency_uuid || accountCurrencyUuid;
      const effectiveDate = row.correction_date
        ? new Date(row.correction_date)
        : row.transaction_date
          ? new Date(row.transaction_date)
          : null;
      const accountAmount = toNumber(row.account_currency_amount) ?? 0;

      const nominalAmount =
        effectiveDate && accountCurrencyCode && nominalCurrencyUuid
          ? calculateNominalAmount(
              Number(accountAmount),
              accountCurrencyCode,
              nominalCurrencyUuid,
              effectiveDate,
              nbgRatesMap,
              currencyCache
            )
          : Number(accountAmount);

      const currentNominalAmount = toNumber(row.nominal_amount);
      const shouldUpdate =
        String(row.nominal_currency_uuid || '') !== String(nominalCurrencyUuid || '') ||
        Number(currentNominalAmount ?? 0) !== Number(nominalAmount);

      if (!shouldUpdate) continue;

      const { error: updateError } = await supabase
        .from(tableName)
        .update({
          nominal_currency_uuid: nominalCurrencyUuid,
          nominal_amount: nominalAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateError) throw updateError;
      updated += 1;
    }

    offset += batchSize;
    console.log(`${tableName}: scanned ${scanned}, updated ${updated}`);
  }

  console.log(`\n${tableName} complete. Scanned ${scanned}, updated ${updated}.`);
}

async function main() {
  console.log(`Fixing nominal amounts for counteragent: ${counteragentUuid}`);
  console.log(`Tables: ${tables.join(', ')}`);
  for (const tableName of tables) {
    await fixTable(tableName);
  }
}

main().catch((error) => {
  console.error('Fix failed:', error);
  process.exit(1);
});