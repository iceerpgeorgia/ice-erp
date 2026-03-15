/*
  Reconcile BOG DB rows against BOG API statement counts with API priority.

  Usage:
    node scripts/reconcile-bog-api-priority.js --mode dry-run --start 2026-01-01 --end 2026-03-14
    node scripts/reconcile-bog-api-priority.js --mode apply --start 2026-01-01 --end 2026-03-14

  Notes:
    - Uses local API endpoint /api/integrations/bog/statements
    - dry-run does NOT write to DB
    - apply triggers import=1 only for account/day mismatches
*/

const BASE = 'https://fojbzghphznbslqwurrm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvamJ6Z2hwaHpuYnNscXd1cnJtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5NTYxMywiZXhwIjoyMDc3MTcxNjEzfQ.LItw6fL0Go4IRllC7D1bp_xjFFrNf31chAk5rzr4KM0';
const INSIDER_FALLBACK = '2a55debb-261b-4ce9-bae4-296ddea037ab';

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
};

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    start: '2026-01-01',
    end: new Date().toISOString().slice(0, 10),
    port: null,
    overrideConversions: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const cur = argv[i];
    const next = argv[i + 1];
    if (cur === '--mode' && next) {
      args.mode = next;
      i += 1;
    } else if (cur === '--start' && next) {
      args.start = next;
      i += 1;
    } else if (cur === '--end' && next) {
      args.end = next;
      i += 1;
    } else if (cur === '--port' && next) {
      args.port = Number(next);
      i += 1;
    } else if (cur === '--override-conversions') {
      args.overrideConversions = true;
    }
  }

  if (!['dry-run', 'apply'].includes(args.mode)) {
    throw new Error('--mode must be dry-run or apply');
  }

  return args;
}

function schemeByCurrency(c) {
  if (c === 'USD') return 'BOG_USD';
  if (c === 'EUR') return 'BOG_EUR';
  if (c === 'AED') return 'BOG_AED';
  if (c === 'GBP') return 'BOG_GBP';
  if (c === 'KZT') return 'BOG_KZT';
  if (c === 'CNY') return 'BOG_CNY';
  if (c === 'TRY') return 'BOG_TRY';
  return 'BOG_GEL';
}

function* days(start, end) {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

async function jsonGet(url, customHeaders = headers) {
  const r = await fetch(url, { headers: customHeaders });
  const t = await r.text();
  let b = null;
  try {
    b = JSON.parse(t);
  } catch {
    b = null;
  }
  if (!r.ok) throw new Error(`${r.status} ${t}`);
  return b;
}

async function dbCount(table, date) {
  const q = `${encodeURIComponent(table)}?select=uuid&transaction_date=eq.${date}`;
  const r = await fetch(`${BASE}/rest/v1/${q}`, {
    headers: {
      ...headers,
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });
  const m = (r.headers.get('content-range') || '').match(/\/(\d+)$/);
  return m ? Number(m[1]) : 0;
}

async function getRowsForDate(table, date) {
  const q = `${encodeURIComponent(table)}?select=uuid,parsing_lock,conversion_id,id&transaction_date=eq.${date}&order=id.desc`;
  const r = await fetch(`${BASE}/rest/v1/${q}`, { headers });
  const t = await r.text();
  let b = null;
  try {
    b = JSON.parse(t);
  } catch {
    b = null;
  }
  if (!r.ok) throw new Error(`${r.status} ${t}`);
  return Array.isArray(b) ? b : [];
}

async function deleteByUuids(table, uuids) {
  if (!uuids || uuids.length === 0) return { deleted: 0 };
  const inList = `(${uuids.map((u) => `"${String(u).replace(/"/g, '')}"`).join(',')})`;
  const q = `${encodeURIComponent(table)}?uuid=in.${encodeURIComponent(inList)}`;
  const r = await fetch(`${BASE}/rest/v1/${q}`, {
    method: 'DELETE',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Delete failed ${r.status} ${t}`);
  }
  return { deleted: uuids.length };
}

function buildPath(a, date) {
  return `/statement/${a.account_number}/${a.currency}/${date}/${date}`;
}

async function apiPreviewCount(port, a, date) {
  const u = new URL(`http://localhost:${port}/api/integrations/bog/statements`);
  u.searchParams.set('import', '0');
  u.searchParams.set('accountUuid', a.uuid);
  u.searchParams.set('accountNoWithCurrency', `${a.account_number}${a.currency}`);
  u.searchParams.set('insiderUuid', a.insider_uuid || INSIDER_FALLBACK);
  u.searchParams.set('currency', a.currency);
  u.searchParams.set('path', buildPath(a, date));

  const r = await fetch(u);
  const t = await r.text();
  let b = null;
  try {
    b = JSON.parse(t);
  } catch {
    b = null;
  }

  return {
    status: r.status,
    ok: b?.ok === true,
    detailsCount: b?.detailsCount ?? 0,
    error: b?.error || null,
  };
}

async function apiApplyImport(port, a, date) {
  const u = new URL(`http://localhost:${port}/api/integrations/bog/statements`);
  u.searchParams.set('import', '1');
  u.searchParams.set('accountUuid', a.uuid);
  u.searchParams.set('accountNoWithCurrency', `${a.account_number}${a.currency}`);
  u.searchParams.set('insiderUuid', a.insider_uuid || INSIDER_FALLBACK);
  u.searchParams.set('currency', a.currency);
  u.searchParams.set('path', buildPath(a, date));

  const r = await fetch(u);
  const t = await r.text();
  let b = null;
  try {
    b = JSON.parse(t);
  } catch {
    b = null;
  }

  return {
    status: r.status,
    ok: b?.ok === true,
    detailsCount: b?.detailsCount ?? 0,
    message: b?.message || null,
    error: b?.error || null,
    raw: b,
  };
}

async function resolvePort(preferredPort) {
  if (preferredPort) return preferredPort;

  for (const p of [3001, 3002, 3000]) {
    try {
      const r = await fetch(`http://localhost:${p}/api/integrations/bog/test`);
      if ([200, 500, 502].includes(r.status)) return p;
    } catch {
      // continue
    }
  }

  throw new Error('Could not find running local app port for /api/integrations/bog/test');
}

async function loadAccounts() {
  const banks = await jsonGet(`${BASE}/rest/v1/banks?select=uuid,bank_name&bank_name=eq.BOG&limit=1`);
  const bankUuid = banks[0]?.uuid;
  if (!bankUuid) throw new Error('BOG bank UUID not found');

  const accountsRaw = await jsonGet(
    `${BASE}/rest/v1/bank_accounts?select=uuid,account_number,currency_uuid,insider_uuid&bank_uuid=eq.${bankUuid}`
  );
  const currencies = await jsonGet(`${BASE}/rest/v1/currencies?select=uuid,code`);
  const cMap = new Map(currencies.map((c) => [c.uuid, String(c.code || '').toUpperCase()]));

  return accountsRaw.map((a) => {
    const account_number = String(a.account_number || '').trim().toUpperCase();
    const currency = cMap.get(a.currency_uuid) || '';
    return {
      ...a,
      account_number,
      currency,
      table: `${account_number}_${schemeByCurrency(currency)}`,
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const port = await resolvePort(args.port);
  const accounts = await loadAccounts();
  const dayList = [...days(args.start, args.end)];

  const mismatches = [];
  let apiTotal = 0;
  let dbTotal = 0;
  let apiErrors = 0;

  for (const d of dayList) {
    for (const a of accounts) {
      const [api, db] = await Promise.all([apiPreviewCount(port, a, d), dbCount(a.table, d)]);

      apiTotal += api.detailsCount;
      dbTotal += db;
      if (!api.ok || api.status !== 200) apiErrors += 1;

      const gap = api.detailsCount - db;
      if (gap !== 0) {
        mismatches.push({
          date: d,
          account: a.account_number,
          currency: a.currency,
          table: a.table,
          apiCount: api.detailsCount,
          dbCount: db,
          gap,
          apiStatus: api.status,
          apiOk: api.ok,
          apiError: api.error,
          accountUuid: a.uuid,
          insiderUuid: a.insider_uuid || null,
        });
      }
    }
  }

  const summary = {
    mode: args.mode,
    range: { start: args.start, end: args.end, days: dayList.length },
    accounts: accounts.length,
    port,
    totals: {
      apiTotal,
      dbTotal,
      totalGap: apiTotal - dbTotal,
      apiErrors,
      mismatchRows: mismatches.length,
    },
  };

  if (args.mode === 'dry-run') {
    console.log(JSON.stringify({ summary, mismatches }, null, 2));
    return;
  }

  const actions = [];
  for (const m of mismatches) {
    const account = accounts.find((a) => a.uuid === m.accountUuid && a.currency === m.currency);
    if (!account) {
      actions.push({ ...m, applied: false, reason: 'Account context missing' });
      continue;
    }

    const applyRes = await apiApplyImport(port, account, m.date);
    let [apiAfter, dbAfter] = await Promise.all([
      apiPreviewCount(port, account, m.date),
      dbCount(account.table, m.date),
    ]);

    let conversionOverride = null;
    if (args.overrideConversions && apiAfter.detailsCount - dbAfter < 0) {
      const excess = Math.abs(apiAfter.detailsCount - dbAfter);
      const dayRows = await getRowsForDate(account.table, m.date);
      const conversionCandidates = dayRows.filter((row) => !row.parsing_lock && !!row.conversion_id);
      const toDelete = conversionCandidates.slice(0, excess).map((row) => row.uuid);

      if (toDelete.length > 0) {
        await deleteByUuids(account.table, toDelete);
        const [apiAfterOverride, dbAfterOverride] = await Promise.all([
          apiPreviewCount(port, account, m.date),
          dbCount(account.table, m.date),
        ]);
        apiAfter = apiAfterOverride;
        dbAfter = dbAfterOverride;
        conversionOverride = {
          requestedExcess: excess,
          deleted: toDelete.length,
          uuids: toDelete,
        };
      } else {
        conversionOverride = {
          requestedExcess: excess,
          deleted: 0,
          reason: 'No non-locked conversion rows available to delete',
        };
      }
    }

    actions.push({
      date: m.date,
      account: m.account,
      currency: m.currency,
      table: m.table,
      before: { api: m.apiCount, db: m.dbCount, gap: m.gap },
      importCall: {
        ok: applyRes.ok,
        status: applyRes.status,
        detailsCount: applyRes.detailsCount,
        message: applyRes.message,
        error: applyRes.error,
      },
      after: {
        api: apiAfter.detailsCount,
        db: dbAfter,
        gap: apiAfter.detailsCount - dbAfter,
      },
      conversionOverride,
    });
  }

  const finalMismatches = actions.filter((a) => a.after && a.after.gap !== 0).length;

  console.log(
    JSON.stringify(
      {
        summary,
        apply: {
          attempted: actions.length,
          stillMismatched: finalMismatches,
        },
        actions,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
