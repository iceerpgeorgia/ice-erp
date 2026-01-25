import { readFileSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import { config } from 'dotenv';
import { getSupabaseClient } from '../lib/bank-import/db-utils';
import { processBOGGELDeconsolidated } from '../lib/bank-import/import_bank_xml_data_deconsolidated';

config();

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error('Usage: tsx scripts/test_deconsolidated_import.ts <xml-file>');
  process.exit(1);
}

async function identifyAccount(xmlContent: string) {
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

  return { accountNumber, currencyCode };
}

async function main() {
  const xmlContent = readFileSync(xmlPath, 'utf-8');
  const { accountNumber, currencyCode } = await identifyAccount(xmlContent);

  const supabase = getSupabaseClient();
  const { data: currencyData } = await supabase
    .from('currencies')
    .select('uuid')
    .eq('code', currencyCode)
    .single();

  if (!currencyData) {
    throw new Error(`Currency not found: ${currencyCode}`);
  }

  const accountNumberNoCcy = accountNumber.slice(0, -3);
  const { data: accountDataExact } = await supabase
    .from('bank_accounts')
    .select('uuid, account_number')
    .eq('account_number', accountNumber)
    .eq('currency_uuid', currencyData.uuid)
    .single();

  let accountData = accountDataExact;

  if (!accountData) {
    const { data: accountDataFallback } = await supabase
      .from('bank_accounts')
      .select('uuid, account_number')
      .eq('account_number', accountNumberNoCcy)
      .eq('currency_uuid', currencyData.uuid)
      .single();

    accountData = accountDataFallback || null;
  }

  if (!accountData) {
    throw new Error(`Account not found for ${accountNumber}`);
  }

  const importBatchId = `test-${Date.now()}`;
  const accountNumberForTable = accountData.account_number || accountNumberNoCcy;
  console.log(`Import batch: ${importBatchId}`);
  console.log(`Account: ${accountNumberForTable}${currencyCode} (UUID: ${accountData.uuid})`);

  await processBOGGELDeconsolidated(
    xmlContent,
    accountData.uuid,
    accountNumberForTable,
    currencyCode,
    importBatchId
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
