import fs from 'fs';
import path from 'path';
import { getSupabaseClient, loadNBGRates, loadCurrencyCache } from '../lib/bank-import/db-utils';
import type { NBGRates } from '../lib/bank-import/types';

type Candidate = {
  dockey: string;
  date: Date;
  senderAcctNo: string;
  benefAcctNo: string;
  docSrcAmt: string;
  docDstAmt: string;
  docSrcCcy: string;
  docDstCcy: string;
};

type TableRow = {
  uuid: string;
  dockey: string;
  conversion_id: string | null;
  docsenderacctno: string | null;
  docbenefacctno: string | null;
  docsrcamt: string | null;
  docdstamt: string | null;
  docsrcccy: string | null;
  docdstccy: string | null;
  transaction_date: string | null;
};

type AccountRow = {
  uuid: string;
  account_number: string;
  currency_uuid: string;
  currency_code: string;
};

const defaultTables = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE74BG0000000586388146_BOG_USD',
  'GE78BG0000000893486000_BOG_USD',
  'GE78BG0000000893486000_BOG_EUR',
  'GE78BG0000000893486000_BOG_AED',
  'GE78BG0000000893486000_BOG_GBP',
  'GE78BG0000000893486000_BOG_KZT',
  'GE78BG0000000893486000_BOG_CNY',
  'GE78BG0000000893486000_BOG_TRY',
];

const batchSize = Number(process.env.BATCH_SIZE ?? '1000');
const verbose = process.argv.includes('--verbose');

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function defaultSchemeByCurrency(code: string) {
  if (code === 'USD') return 'BOG_USD';
  if (code === 'EUR') return 'BOG_EUR';
  if (code === 'AED') return 'BOG_AED';
  if (code === 'GBP') return 'BOG_GBP';
  if (code === 'KZT') return 'BOG_KZT';
  if (code === 'CNY') return 'BOG_CNY';
  if (code === 'TRY') return 'BOG_TRY';
  return 'BOG_GEL';
}

function resolveDeconsolidatedTableName(accountNumber: string, parsingScheme: string): string {
  const safeScheme = parsingScheme.replace(/[^A-Za-z0-9_]/g, '_');
  return `${accountNumber}_${safeScheme}`;
}

async function fetchBatch(
  supabase: ReturnType<typeof getSupabaseClient>,
  tableName: string,
  from: number,
  to: number
): Promise<TableRow[]> {
  if (verbose) {
    console.log(`  🔎 Fetching ${tableName} rows ${from}-${to}...`);
  }
  const { data, error } = await supabase
    .from(tableName)
    .select(
      'uuid,dockey,conversion_id,docsenderacctno,docbenefacctno,docsrcamt,docdstamt,docsrcccy,docdstccy,transaction_date'
    )
    .is('conversion_id', null)
    .order('id', { ascending: true })
    .range(from, to);

  if (error) throw error;
  if (verbose) {
    console.log(`  ✅ Fetched ${data?.length ?? 0} rows from ${tableName}`);
  }
  return (data ?? []) as TableRow[];
}

async function main() {
  loadEnv();

  const tableArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const tableNames = tableArgs.length > 0 ? tableArgs : defaultTables;

  console.log(`🔁 Backfill conversions for ${tableNames.length} tables`);
  console.log(`📦 Tables: ${tableNames.join(', ')}`);
  const supabase = getSupabaseClient();

  const [nbgRatesMap, currencyCache] = await Promise.all([
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { data: bankAccountsData, error: bankAccountsError } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number, currency_uuid');
  if (bankAccountsError) throw bankAccountsError;

  const bankAccountsMap = new Map<string, AccountRow>();
  const bankAccountsByNumber = new Map<string, AccountRow>();

  for (const row of bankAccountsData ?? []) {
    const currencyCode = currencyCache.get(row.currency_uuid) || '';
    const accountNumber = String(row.account_number || '').trim();
    if (!accountNumber || !currencyCode) continue;
    const key = `${accountNumber}_${currencyCode}`;
    const accountRow: AccountRow = {
      uuid: row.uuid,
      account_number: accountNumber,
      currency_uuid: row.currency_uuid,
      currency_code: currencyCode,
    };
    bankAccountsMap.set(key, accountRow);
    if (!bankAccountsByNumber.has(accountNumber)) {
      bankAccountsByNumber.set(accountNumber, accountRow);
    }
  }

  const resolveAccountLookup = (acctNo: string) => {
    const trimmed = acctNo.trim();
    const match = trimmed.match(/^(.+?)([A-Z]{3})$/);
    if (match) {
      const baseNumber = match[1];
      const currencyCode = match[2];
      const key = `${baseNumber}_${currencyCode}`;
      return bankAccountsMap.get(key) || null;
    }
    return bankAccountsByNumber.get(trimmed) || null;
  };

  const getRate = (dateKey: string, currencyCode: string) => {
    if (currencyCode === 'GEL') return 1;
    const rates = nbgRatesMap.get(dateKey);
    if (!rates) return null;
    const rate = rates[currencyCode as keyof NBGRates];
    return rate && rate > 0 ? Number(rate) : null;
  };

  const resolveAmounts = (
    outCurrency: string,
    inCurrency: string,
    docSrcCcy: string,
    docDstCcy: string,
    docSrcAmt: string,
    docDstAmt: string
  ) => {
    const srcAmt = Number(docSrcAmt);
    const dstAmt = Number(docDstAmt);
    if (docSrcCcy === outCurrency && docDstCcy === inCurrency) {
      return { amountOut: srcAmt, amountIn: dstAmt };
    }
    if (docSrcCcy === inCurrency && docDstCcy === outCurrency) {
      return { amountOut: dstAmt, amountIn: srcAmt };
    }
    return null;
  };

  const candidates = new Map<string, Candidate>();
  const rowsByTable = new Map<string, Map<string, TableRow>>();

  for (const tableName of tableNames) {
    console.log(`📦 Scanning ${tableName}...`);
    let offset = 0;
    let tableRows = 0;
    let tableCandidates = 0;

    while (true) {
      if (!verbose && offset % (batchSize * 5) === 0) {
        console.log(`  ⏳ ${tableName}: scanning offset ${offset}...`);
      }
      const rows = await fetchBatch(supabase, tableName, offset, offset + batchSize - 1);
      if (rows.length === 0) break;

      let tableMap = rowsByTable.get(tableName);
      if (!tableMap) {
        tableMap = new Map();
        rowsByTable.set(tableName, tableMap);
      }

      for (const row of rows) {
        if (!row.dockey) continue;
        if (!tableMap.has(row.dockey)) {
          tableMap.set(row.dockey, row);
        }

        if (!candidates.has(row.dockey)) {
          const senderAcctNo = row.docsenderacctno?.trim();
          const benefAcctNo = row.docbenefacctno?.trim();
          const docSrcAmt = row.docsrcamt?.trim();
          const docDstAmt = row.docdstamt?.trim();
          const docSrcCcy = row.docsrcccy?.trim().toUpperCase();
          const docDstCcy = row.docdstccy?.trim().toUpperCase();
          const transactionDate = row.transaction_date ? new Date(row.transaction_date) : null;

          if (
            senderAcctNo &&
            benefAcctNo &&
            docSrcAmt &&
            docDstAmt &&
            docSrcCcy &&
            docDstCcy &&
            transactionDate
          ) {
            candidates.set(row.dockey, {
              dockey: row.dockey,
              date: transactionDate,
              senderAcctNo,
              benefAcctNo,
              docSrcAmt,
              docDstAmt,
              docSrcCcy,
              docDstCcy,
            });
            tableCandidates += 1;
          } else if (verbose) {
            console.log(
              `  ⚠️  Missing candidate fields for ${row.dockey} in ${tableName}: sender=${Boolean(
                senderAcctNo
              )} benef=${Boolean(benefAcctNo)} srcAmt=${Boolean(docSrcAmt)} dstAmt=${Boolean(
                docDstAmt
              )} srcCcy=${Boolean(docSrcCcy)} dstCcy=${Boolean(docDstCcy)} date=${Boolean(
                transactionDate
              )}`
            );
          }
        }
        tableRows += 1;
      }

      offset += batchSize;
    }

    console.log(`  📄 Rows scanned: ${tableRows}`);
    console.log(`  🧭 Candidates added: ${tableCandidates}`);
  }

  console.log(`🔍 Candidates collected: ${candidates.size}`);

  let conversionsInserted = 0;
  let conversionsLinked = 0;
  let skippedMissingAccounts = 0;
  let skippedSameCurrency = 0;
  let skippedMissingPair = 0;
  let skippedExistingConversion = 0;
  let skippedAmountResolution = 0;
  let skippedMissingRates = 0;

  let processedCandidates = 0;
  for (const candidate of candidates.values()) {
    processedCandidates += 1;
    if (!verbose && processedCandidates % 500 === 0) {
      console.log(`  ⏳ Processing candidates: ${processedCandidates}/${candidates.size}`);
    }
    const senderAccount = resolveAccountLookup(candidate.senderAcctNo);
    const benefAccount = resolveAccountLookup(candidate.benefAcctNo);

    if (!senderAccount || !benefAccount) {
      skippedMissingAccounts += 1;
      if (verbose) {
        console.log(`  ⚠️  Missing account match for ${candidate.dockey}`);
      }
      continue;
    }
    if (senderAccount.currency_code === benefAccount.currency_code) {
      skippedSameCurrency += 1;
      continue;
    }

    const outAccount = senderAccount;
    const inAccount = benefAccount;

    const tableOut = resolveDeconsolidatedTableName(
      outAccount.account_number,
      defaultSchemeByCurrency(outAccount.currency_code)
    );
    const tableIn = resolveDeconsolidatedTableName(
      inAccount.account_number,
      defaultSchemeByCurrency(inAccount.currency_code)
    );

    const outRow = rowsByTable.get(tableOut)?.get(candidate.dockey) || null;
    const inRow = rowsByTable.get(tableIn)?.get(candidate.dockey) || null;

    if (!outRow || !inRow) {
      skippedMissingPair += 1;
      if (verbose) {
        console.log(`  ⚠️  Missing paired rows for ${candidate.dockey} (${tableOut}, ${tableIn})`);
      }
      continue;
    }
    if (outRow.conversion_id || inRow.conversion_id) {
      skippedExistingConversion += 1;
      continue;
    }

    const amounts = resolveAmounts(
      outAccount.currency_code,
      inAccount.currency_code,
      candidate.docSrcCcy,
      candidate.docDstCcy,
      candidate.docSrcAmt,
      candidate.docDstAmt
    );

    if (!amounts) {
      skippedAmountResolution += 1;
      if (verbose) {
        console.log(
          `  ⚠️  Amount resolution failed for ${candidate.dockey} (src=${candidate.docSrcCcy}/${candidate.docSrcAmt}, dst=${candidate.docDstCcy}/${candidate.docDstAmt})`
        );
      }
      continue;
    }

    const dateKey = candidate.date.toISOString().split('T')[0];
    const rateOut = getRate(dateKey, outAccount.currency_code);
    const rateIn = getRate(dateKey, inAccount.currency_code);
    let fee: number | null = null;

    if (rateOut !== null && rateIn !== null) {
      if (outAccount.currency_code === 'GEL') {
        fee = amounts.amountOut - amounts.amountIn * rateIn;
      } else {
        fee = (amounts.amountOut * rateOut - amounts.amountIn * rateIn) / rateOut;
      }
    } else {
      skippedMissingRates += 1;
    }

    const { data: existingConversion } = await supabase
      .from('conversion')
      .select('uuid')
      .eq('key_value', candidate.dockey)
      .eq('account_out_uuid', outAccount.uuid)
      .eq('account_in_uuid', inAccount.uuid)
      .maybeSingle();

    let conversionUuid = existingConversion?.uuid as string | undefined;

    if (!conversionUuid) {
      const { data: insertedConversion, error: conversionError } = await supabase
        .from('conversion')
        .insert({
          date: dateKey,
          key_value: candidate.dockey,
          account_out_uuid: outAccount.uuid,
          account_in_uuid: inAccount.uuid,
          currency_out_uuid: outAccount.currency_uuid,
          currency_in_uuid: inAccount.currency_uuid,
          amount_out: amounts.amountOut,
          amount_in: amounts.amountIn,
          fee: fee,
        })
        .select('uuid')
        .single();

      if (conversionError) {
        console.warn(`⚠️ Failed to insert conversion for ${candidate.dockey}: ${conversionError.message}`);
        continue;
      }

      conversionUuid = insertedConversion?.uuid;
      conversionsInserted += 1;
    }

    if (!conversionUuid) continue;

    await supabase.from(tableOut).update({ conversion_id: conversionUuid }).eq('uuid', outRow.uuid);
    await supabase.from(tableIn).update({ conversion_id: conversionUuid }).eq('uuid', inRow.uuid);
    conversionsLinked += 1;
  }

  console.log('✅ Backfill complete');
  console.log(`  ➕ Conversions inserted: ${conversionsInserted}`);
  console.log(`  🔗 Pairs linked: ${conversionsLinked}`);
  console.log(`  ⚠️  Skipped missing accounts: ${skippedMissingAccounts}`);
  console.log(`  ⚠️  Skipped same currency: ${skippedSameCurrency}`);
  console.log(`  ⚠️  Skipped missing pairs: ${skippedMissingPair}`);
  console.log(`  ⚠️  Skipped existing conversion links: ${skippedExistingConversion}`);
  console.log(`  ⚠️  Skipped amount resolution: ${skippedAmountResolution}`);
  console.log(`  ⚠️  Skipped missing rates: ${skippedMissingRates}`);
}

console.log('▶️ backfill-conversions starting...');

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
