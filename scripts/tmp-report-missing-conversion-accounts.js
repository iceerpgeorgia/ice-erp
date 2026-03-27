require('dotenv/config');
const { Client } = require('pg');

const TABLES = [
  'GE74BG0000000586388146_BOG_USD',
  'GE78BG0000000893486000_BOG_AED',
  'GE78BG0000000893486000_BOG_CNY',
  'GE78BG0000000893486000_BOG_EUR',
  'GE78BG0000000893486000_BOG_GBP',
  'GE78BG0000000893486000_BOG_GEL',
  'GE78BG0000000893486000_BOG_KZT',
  'GE78BG0000000893486000_BOG_TRY',
  'GE78BG0000000893486000_BOG_USD',
];

function defaultSchemeByCurrency(code) {
  if (code === 'USD') return 'BOG_USD';
  if (code === 'EUR') return 'BOG_EUR';
  if (code === 'AED') return 'BOG_AED';
  if (code === 'GBP') return 'BOG_GBP';
  if (code === 'KZT') return 'BOG_KZT';
  if (code === 'CNY') return 'BOG_CNY';
  if (code === 'TRY') return 'BOG_TRY';
  return 'BOG_GEL';
}

function resolveDeconsolidatedTableName(accountNumber, parsingScheme) {
  const safeScheme = String(parsingScheme || '').replace(/[^A-Za-z0-9_]/g, '_');
  return `${accountNumber}_${safeScheme}`;
}

function hasConversionHint(value) {
  if (!value) return false;
  return /(კონვერტ|conversion|convert|exchange|fx)/i.test(String(value));
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function fetchRows(client, tableName) {
  const sql = `
    SELECT uuid, dockey, entriesid, conversion_id, bank_account_uuid, account_currency_amount,
           description, docsenderacctno, docbenefacctno, docsrcamt, docdstamt, docsrcccy, docdstccy,
           transaction_date, id
    FROM "${tableName}"
    WHERE conversion_id IS NULL
    ORDER BY id ASC
  `;
  const q = await client.query(sql);
  return q.rows.map((r) => ({ table: tableName, ...r }));
}

async function main() {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DIRECT_DATABASE_URL or DATABASE_URL');

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const currenciesQ = await client.query('SELECT uuid::text AS uuid, code FROM currencies');
    const currencyByUuid = new Map(currenciesQ.rows.map((r) => [String(r.uuid), String(r.code || '').trim().toUpperCase()]));

    const accountsQ = await client.query(
      'SELECT uuid::text AS uuid, account_number, currency_uuid::text AS currency_uuid, insider_uuid::text AS insider_uuid FROM bank_accounts'
    );

    const bankAccountsMap = new Map();
    const bankAccountsByNumber = new Map();
    const bankAccountsByUuid = new Map();

    for (const row of accountsQ.rows) {
      const accountNumber = String(row.account_number || '').trim();
      const currencyCode = currencyByUuid.get(String(row.currency_uuid)) || '';
      if (!accountNumber || !currencyCode) continue;
      const account = {
        uuid: String(row.uuid),
        account_number: accountNumber,
        currency_uuid: String(row.currency_uuid),
        currency_code: currencyCode,
        insider_uuid: row.insider_uuid ? String(row.insider_uuid) : null,
      };
      bankAccountsMap.set(`${accountNumber}_${currencyCode}`, account);
      bankAccountsByUuid.set(account.uuid, account);
      if (!bankAccountsByNumber.has(accountNumber)) bankAccountsByNumber.set(accountNumber, account);
    }

    const resolveAccountLookup = (acctNo) => {
      const trimmed = String(acctNo || '').trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?)([A-Z]{3})$/);
      if (match) {
        const key = `${match[1]}_${match[2]}`;
        return bankAccountsMap.get(key) || null;
      }
      return bankAccountsByNumber.get(trimmed) || null;
    };

    const inferCounterpartAccount = (knownAccount, docSrcCcy, docDstCcy) => {
      const src = String(docSrcCcy || '').trim().toUpperCase();
      const dst = String(docDstCcy || '').trim().toUpperCase();
      const knownCcy = String(knownAccount.currency_code || '').trim().toUpperCase();
      let counterpartCcy = null;
      if (src === knownCcy && dst !== knownCcy) counterpartCcy = dst;
      if (dst === knownCcy && src !== knownCcy) counterpartCcy = src;
      if (!counterpartCcy) return null;
      return bankAccountsMap.get(`${knownAccount.account_number}_${counterpartCcy}`) || null;
    };

    const resolveConversionAccounts = (candidate) => {
      const senderAccount = resolveAccountLookup(candidate.senderAcctNo);
      const benefAccount = resolveAccountLookup(candidate.benefAcctNo);

      if (senderAccount && benefAccount && senderAccount.currency_code !== benefAccount.currency_code) {
        return { outAccount: senderAccount, inAccount: benefAccount, mode: 'direct' };
      }

      const srcCcy = String(candidate.docSrcCcy || '').trim().toUpperCase();
      const dstCcy = String(candidate.docDstCcy || '').trim().toUpperCase();

      if (senderAccount && !benefAccount) {
        const inferredIn = inferCounterpartAccount(senderAccount, srcCcy, dstCcy);
        if (inferredIn && inferredIn.currency_code !== senderAccount.currency_code) {
          return { outAccount: senderAccount, inAccount: inferredIn, mode: 'sender_inferred' };
        }
      }

      if (!senderAccount && benefAccount) {
        const inferredOut = inferCounterpartAccount(benefAccount, srcCcy, dstCcy);
        if (inferredOut && inferredOut.currency_code !== benefAccount.currency_code) {
          return { outAccount: inferredOut, inAccount: benefAccount, mode: 'benef_inferred' };
        }
      }

      return null;
    };

    const allRows = [];
    for (const table of TABLES) {
      const rows = await fetchRows(client, table);
      allRows.push(...rows);
    }

    const rowsByTable = new Map();
    for (const row of allRows) {
      let tableMap = rowsByTable.get(row.table);
      if (!tableMap) {
        tableMap = new Map();
        rowsByTable.set(row.table, tableMap);
      }
      if (!tableMap.has(row.dockey)) {
        tableMap.set(row.dockey, row);
      }
    }

    const candidates = new Map();
    for (const row of allRows) {
      if (!row.dockey) continue;
      if (candidates.has(row.dockey)) continue;

      const senderAcctNo = row.docsenderacctno ? String(row.docsenderacctno).trim() : null;
      const benefAcctNo = row.docbenefacctno ? String(row.docbenefacctno).trim() : null;
      const docSrcAmt = row.docsrcamt ? String(row.docsrcamt).trim() : null;
      const docDstAmt = row.docdstamt ? String(row.docdstamt).trim() : null;
      const docSrcCcy = row.docsrcccy ? String(row.docsrcccy).trim().toUpperCase() : null;
      const docDstCcy = row.docdstccy ? String(row.docdstccy).trim().toUpperCase() : null;
      const date = normalizeDate(row.transaction_date);
      const hasCrossCurrencyMetadata = Boolean(docSrcCcy && docDstCcy && docSrcCcy !== docDstCcy);
      const hasConversionLikeText = hasConversionHint(row.description);

      if (
        senderAcctNo &&
        benefAcctNo &&
        docSrcAmt &&
        docDstAmt &&
        docSrcCcy &&
        docDstCcy &&
        date &&
        (hasCrossCurrencyMetadata || hasConversionLikeText)
      ) {
        candidates.set(row.dockey, {
          dockey: row.dockey,
          senderAcctNo,
          benefAcctNo,
          docSrcAmt,
          docDstAmt,
          docSrcCcy,
          docDstCcy,
          date,
          sampleDescription: row.description || null,
        });
      }
    }

    const resolveConversionAccountsFromRows = (dockey) => {
      const matched = [];
      for (const tableMap of rowsByTable.values()) {
        const row = tableMap.get(dockey);
        if (!row?.bank_account_uuid) continue;
        const account = bankAccountsByUuid.get(String(row.bank_account_uuid));
        if (!account) continue;
        matched.push({ row, account, amount: Number(row.account_currency_amount ?? NaN) });
      }
      const out = matched.find((m) => Number.isFinite(m.amount) && m.amount < 0);
      const inRow = matched.find((m) => Number.isFinite(m.amount) && m.amount > 0 && (!out || m.account.uuid !== out.account.uuid));
      if (!out || !inRow) return null;
      if (out.account.currency_code === inRow.account.currency_code) return null;
      return { outAccount: out.account, inAccount: inRow.account, mode: 'row_fallback' };
    };

    const missing = [];

    for (const candidate of candidates.values()) {
      const primary = resolveConversionAccounts(candidate);
      const rowFallback = primary ? null : resolveConversionAccountsFromRows(candidate.dockey);
      const resolved = primary || rowFallback;
      if (resolved) continue;

      const senderResolved = resolveAccountLookup(candidate.senderAcctNo);
      const benefResolved = resolveAccountLookup(candidate.benefAcctNo);

      const matchedRows = [];
      for (const tableMap of rowsByTable.values()) {
        const row = tableMap.get(candidate.dockey);
        if (row) {
          matchedRows.push({
            table: row.table,
            bank_account_uuid: row.bank_account_uuid,
            account_currency_amount: row.account_currency_amount,
            docsrcccy: row.docsrcccy,
            docdstccy: row.docdstccy,
            description: row.description,
          });
        }
      }

      missing.push({
        dockey: candidate.dockey,
        date: candidate.date,
        senderAcctNo: candidate.senderAcctNo,
        benefAcctNo: candidate.benefAcctNo,
        senderResolved: senderResolved ? {
          uuid: senderResolved.uuid,
          account_number: senderResolved.account_number,
          currency_code: senderResolved.currency_code,
        } : null,
        benefResolved: benefResolved ? {
          uuid: benefResolved.uuid,
          account_number: benefResolved.account_number,
          currency_code: benefResolved.currency_code,
        } : null,
        docSrcCcy: candidate.docSrcCcy,
        docDstCcy: candidate.docDstCcy,
        docSrcAmt: candidate.docSrcAmt,
        docDstAmt: candidate.docDstAmt,
        sampleDescription: candidate.sampleDescription,
        matchedRows,
      });
    }

    const summary = {
      totalCandidates: candidates.size,
      missingAccountCandidates: missing.length,
      senderMissing: missing.filter((m) => !m.senderResolved).length,
      benefMissing: missing.filter((m) => !m.benefResolved).length,
      bothMissing: missing.filter((m) => !m.senderResolved && !m.benefResolved).length,
      rowFallbackNoOutInPair: missing.filter((m) => {
        const hasNeg = m.matchedRows.some((r) => Number(r.account_currency_amount) < 0);
        const hasPos = m.matchedRows.some((r) => Number(r.account_currency_amount) > 0);
        return !(hasNeg && hasPos);
      }).length,
    };

    console.log(JSON.stringify({ summary, missing }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
