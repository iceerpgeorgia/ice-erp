import { parseStringPromise } from 'xml2js';
import { v4 as uuidv4 } from 'uuid';
import { processBOGGEL } from '../lib/bank-import/import_bank_xml_data';
import { getSupabaseClient } from '../lib/bank-import/db-utils';
import fs from 'fs/promises';

const loadEnvFile = async (path: string) => {
  try {
    const content = await fs.readFile(path, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore missing env files
  }
};

const filePath = 'Statement_214320385.xml';

async function main() {
  await loadEnvFile('.env.local');
  await loadEnvFile('.env');

  const xmlContent = await fs.readFile(filePath, 'utf-8');
  const parsed = await parseStringPromise(xmlContent, {
    tagNameProcessors: [(name) => name.replace(/^[^:]+:/, '')],
  });

  let root = parsed.AccountStatement || parsed.STATEMENT || parsed.ROWDATA || parsed;
  if (root && typeof root === 'object' && !root.HEADER && !root.DETAILS && !root.DETAIL) {
    const keys = Object.keys(root);
    if (keys.length === 1) {
      root = root[keys[0]];
    }
  }

  const header = root?.HEADER?.[0];
  if (!header) {
    throw new Error('Invalid BOG GEL XML format - missing HEADER');
  }

  const accountInfoText = header.AcctNo?.[0] || '';
  const accountFull = accountInfoText.split(' ')[0];
  if (accountFull.length <= 3) {
    throw new Error('Invalid account number in XML');
  }

  const currencyCode = accountFull.substring(accountFull.length - 3);
  const accountNumber = accountFull.trim().toUpperCase();
  const accountNumberNoCcy = accountNumber.slice(0, -3);

  const supabase = getSupabaseClient();
  let currencyData = await supabase
    .from('currencies')
    .select('uuid, code')
    .eq('code', currencyCode)
    .single();

  if (!currencyData.data) {
    currencyData = await supabase
      .from('currencies')
      .select('uuid, code')
      .ilike('code', currencyCode)
      .single();
  }

  if (!currencyData.data) {
    const { data: allCurrencies } = await supabase
      .from('currencies')
      .select('uuid, code');
    const matched = allCurrencies?.find(
      (cur) => String(cur.code || '').trim().toUpperCase() === currencyCode
    );
    if (matched) {
      currencyData.data = matched;
    }
  }

  if (!currencyData.data) {
    throw new Error(`Currency not found in database: ${currencyCode}`);
  }

  const { data: accountDataExact } = await supabase
    .from('bank_accounts')
    .select('uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid')
    .eq('account_number', accountNumber)
    .eq('currency_uuid', currencyData.data.uuid)
    .single();

  let accountData = accountDataExact || null;

  if (!accountData) {
    const { data: accountDataFallback } = await supabase
      .from('bank_accounts')
      .select('uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid')
      .eq('account_number', accountNumberNoCcy)
      .eq('currency_uuid', currencyData.data.uuid)
      .single();

    accountData = accountDataFallback || null;
  }

  if (!accountData) {
    throw new Error(
      `Account not found in database: ${accountNumber} (tried without currency: ${accountNumberNoCcy})`
    );
  }

  const accountUuid = accountData.uuid;
  const accountDigits = accountData.account_number.replace(/\D/g, '').slice(-10);
  const rawTableName = accountData.raw_table_name || `bog_gel_raw_${accountDigits}`;

  const importBatchId = uuidv4();

  await processBOGGEL(
    xmlContent,
    accountUuid,
    accountData.account_number,
    currencyCode,
    rawTableName,
    importBatchId
  );

  console.log(`✅ Done. Import batch: ${importBatchId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
