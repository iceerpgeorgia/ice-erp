import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseStringPromise } from 'xml2js';
import { getSupabaseClient } from '../lib/bank-import/db-utils';
import { processTBCGEL } from '../lib/bank-import/import_bank_xml_data';

async function main() {
  const xmlPath = path.join(process.cwd(), 'account_statement_14598270_01012026_02022026.xml');
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');

  const parsed = await parseStringPromise(xmlContent, {
    tagNameProcessors: [(name: string) => name.replace(/^[^:]+:/, '')],
  });

  let root = parsed.AccountStatement || parsed;
  if (root && typeof root === 'object' && !root.Head && !root.Record && !root.Records) {
    const keys = Object.keys(root);
    if (keys.length === 1) {
      root = root[keys[0]];
    }
  }

  const head = root?.Head?.[0];
  if (!head) {
    throw new Error('Invalid TBC XML format - missing Head');
  }

  const accountNumber = String(head.AccountNo?.[0] || '').trim().toUpperCase();
  const currencyCode = String(head.Currency?.[0] || '').trim().toUpperCase();

  if (!accountNumber || !currencyCode) {
    throw new Error('Missing AccountNo or Currency in XML');
  }

  const supabase = getSupabaseClient();
  const { data: currencyData } = await supabase
    .from('currencies')
    .select('uuid')
    .eq('code', currencyCode)
    .single();

  if (!currencyData) {
    throw new Error(`Currency not found: ${currencyCode}`);
  }

  const { data: accountData } = await supabase
    .from('bank_accounts')
    .select('uuid, parsing_scheme_uuid, raw_table_name, account_number, currency_uuid')
    .eq('account_number', accountNumber)
    .eq('currency_uuid', currencyData.uuid)
    .single();

  if (!accountData) {
    throw new Error(`Account not found: ${accountNumber}`);
  }

  const rawTableName = accountData.raw_table_name || `${accountNumber}_TBC_GEL`;
  const importBatchId = uuidv4();

  console.log(`Using account: ${accountNumber} (${currencyCode})`);
  console.log(`Raw table: ${rawTableName}`);
  console.log(`Import batch: ${importBatchId}`);

  await processTBCGEL(
    xmlContent,
    accountData.uuid,
    accountData.account_number,
    currencyCode,
    rawTableName,
    importBatchId
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
