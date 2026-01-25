/**
 * Database utility functions for bank XML import
 * Handles Supabase connections and queries
 */

import { createClient } from '@supabase/supabase-js';
import type { CounteragentData, ParsingRule, PaymentData, NBGRates } from './types';

const DEFAULT_PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const to = from + DEFAULT_PAGE_SIZE - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) throw error;
    const batch = (data || []) as T[];
    results.push(...batch);
    if (batch.length < DEFAULT_PAGE_SIZE) break;
    from += DEFAULT_PAGE_SIZE;
  }

  return results;
}

export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function loadCounteragents(supabase: ReturnType<typeof getSupabaseClient>): Promise<Map<string, CounteragentData>> {
  const start = Date.now();
  console.log('  ⏳ Loading counteragents from Supabase...');

  const data = await fetchAllRows<any>(async (from, to) =>
    await supabase
      .from('counteragents')
      .select('counteragent_uuid, identification_number, counteragent')
      .not('identification_number', 'is', null)
      .range(from, to)
  );

  const map = new Map<string, CounteragentData>();
  for (const row of data || []) {
    const inn = normalizeINN(row.identification_number);
    if (inn) {
      map.set(inn, {
        uuid: row.counteragent_uuid,
        name: row.counteragent,
        inn: inn,
      });
    }
  }

  console.log(`  ✅ Loaded ${map.size} counteragents from Supabase (${((Date.now() - start) / 1000).toFixed(2)}s)`);
  return map;
}

export async function loadParsingRules(supabase: ReturnType<typeof getSupabaseClient>): Promise<ParsingRule[]> {
  const start = Date.now();
  console.log('  ⏳ Loading parsing rules from Supabase...');

  const data = await fetchAllRows<any>(async (from, to) =>
    await supabase
      .from('parsing_scheme_rules')
      .select('id, counteragent_uuid, financial_code_uuid, nominal_currency_uuid, payment_id, column_name, condition, condition_script')
      .range(from, to)
  );

  const rules: ParsingRule[] = (data || []).map(row => {
    let columnName = row.column_name;
    let condition = row.condition;

    // Handle combined condition format: docprodgroup="COM"
    if (!columnName && condition && condition.includes('=')) {
      const parts = condition.split('=');
      columnName = parts[0].trim();
      condition = parts[1].replace(/['"]/g, '').trim();
    }

    return {
      id: row.id,
      counteragent_uuid: row.counteragent_uuid,
      financial_code_uuid: row.financial_code_uuid,
      nominal_currency_uuid: row.nominal_currency_uuid,
      payment_id: row.payment_id,
      column_name: columnName,
      condition: condition,
      condition_script: row.condition_script || null,
    };
  });

  console.log(`  ✅ Loaded ${rules.length} parsing rules from Supabase (${((Date.now() - start) / 1000).toFixed(2)}s)`);
  return rules;
}

function getSalaryBaseKey(paymentId: string): string | null {
  const trimmed = paymentId.trim();
  if (trimmed.length < 20) return null;
  return trimmed.slice(0, 20).toLowerCase();
}

function parseSalaryPeriod(paymentId: string): { month: number; year: number } | null {
  const match = paymentId.match(/_PRL(\d{2})(\d{4})$/i);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  return { month, year };
}

export async function loadPayments(
  supabase: ReturnType<typeof getSupabaseClient>
): Promise<{
  paymentsMap: Map<string, PaymentData>;
  salaryBaseMap: Map<string, PaymentData>;
  salaryLatestMap: Map<string, { month: number; year: number; data: PaymentData }>;
}> {
  const start = Date.now();
  console.log('  ⏳ Loading payments and salary_accruals from Supabase...');

  // Load from both payments and salary_accruals tables
  const [paymentsData, salaryData] = await Promise.all([
    fetchAllRows<any>(async (from, to) =>
      await supabase
        .from('payments')
        .select('payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid')
        .not('payment_id', 'is', null)
        .range(from, to)
    ),
    fetchAllRows<any>(async (from, to) =>
      await supabase
        .from('salary_accruals')
        .select('payment_id, counteragent_uuid, financial_code_uuid, nominal_currency_uuid')
        .not('payment_id', 'is', null)
        .range(from, to)
    ),
  ]);

  const map = new Map<string, PaymentData>();
  const salaryBaseMap = new Map<string, PaymentData>();
  const salaryLatestMap = new Map<string, { month: number; year: number; data: PaymentData }>();
  let paymentsCount = 0;
  let salaryCount = 0;
  let salaryBaseCount = 0;
  let salaryLatestCount = 0;

  // Add payments
  for (const row of paymentsData || []) {
    const paymentId = row.payment_id?.trim().toLowerCase();
    if (paymentId) {
      map.set(paymentId, {
        counteragent_uuid: row.counteragent_uuid,
        project_uuid: row.project_uuid,
        financial_code_uuid: row.financial_code_uuid,
        currency_uuid: row.currency_uuid,
        source: 'payments',
      });
      paymentsCount++;
    }
  }

  // Add salary accruals
  for (const row of salaryData || []) {
    const paymentId = row.payment_id?.trim().toLowerCase();
    if (paymentId) {
      const salaryDataEntry: PaymentData = {
        counteragent_uuid: row.counteragent_uuid,
        project_uuid: null,
        financial_code_uuid: row.financial_code_uuid,
        currency_uuid: row.nominal_currency_uuid,
        source: 'salary',
      };
      map.set(paymentId, salaryDataEntry);
      const baseKey = getSalaryBaseKey(paymentId);
      if (baseKey && !salaryBaseMap.has(baseKey)) {
        salaryBaseMap.set(baseKey, salaryDataEntry);
        salaryBaseCount++;
      }

      const period = parseSalaryPeriod(paymentId);
      if (baseKey && period) {
        const existing = salaryLatestMap.get(baseKey);
        if (!existing || period.year > existing.year || (period.year === existing.year && period.month > existing.month)) {
          salaryLatestMap.set(baseKey, { ...period, data: salaryDataEntry });
        }
      }
      salaryCount++;
    }
  }

  salaryLatestCount = salaryLatestMap.size;
  console.log(`  ✅ Loaded ${map.size} payment IDs from Supabase via UNION query (${((Date.now() - start) / 1000).toFixed(2)}s)`);
  console.log(
    `     └─ payments: ${paymentsCount}, salary_accruals: ${salaryCount}, salary_base_keys: ${salaryBaseCount}, salary_latest: ${salaryLatestCount}`
  );
  return { paymentsMap: map, salaryBaseMap, salaryLatestMap };
}

export async function loadNBGRates(supabase: ReturnType<typeof getSupabaseClient>): Promise<Map<string, NBGRates>> {
  const start = Date.now();
  console.log('  ⏳ Loading NBG exchange rates from Supabase...');

  const data = await fetchAllRows<any>(async (from, to) =>
    await supabase
      .from('nbg_exchange_rates')
      .select('date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate')
      .range(from, to)
  );

  const map = new Map<string, NBGRates>();
  for (const row of data || []) {
    const dateKey = new Date(row.date).toISOString().split('T')[0];
    map.set(dateKey, {
      USD: row.usd_rate,
      EUR: row.eur_rate,
      CNY: row.cny_rate,
      GBP: row.gbp_rate,
      RUB: row.rub_rate,
      TRY: row.try_rate,
      AED: row.aed_rate,
      KZT: row.kzt_rate,
    });
  }

  console.log(`  ✅ Loaded NBG rates for ${map.size} dates from Supabase (${((Date.now() - start) / 1000).toFixed(2)}s)`);
  return map;
}

export async function loadCurrencyCache(supabase: ReturnType<typeof getSupabaseClient>): Promise<Map<string, string>> {
  console.log('  🔄 Loading currency cache...');
  const data = await fetchAllRows<any>(async (from, to) =>
    await supabase.from('currencies').select('uuid, code').range(from, to)
  );

  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.uuid, row.code);
  }

  console.log(`  ✅ Loaded ${map.size} currencies\n`);
  return map;
}

/**
 * Normalize INN: if 10 digits, prepend '0' to make it 11
 */
export function normalizeINN(inn: string | null | undefined): string | null {
  if (!inn) return null;
  const trimmed = inn.trim();
  if (trimmed.length === 10 && /^\d+$/.test(trimmed)) {
    return '0' + trimmed;
  }
  return trimmed;
}

/**
 * Extract payment ID from DocInformation field with multiple pattern strategies
 */
export function extractPaymentID(docInformation: string | null | undefined): string | null {
  if (!docInformation) return null;

  const text = docInformation.trim();

  // Strategy 1: Look for explicit "payment_id: 12345" or "payment id: 12345"
  let match = text.match(/payment[_\s]*id[:\s]*(\w+)/i);
  if (match) return match[1];

  // Strategy 2: Look for "ID: 12345" or "id: 12345" at start of string
  match = text.match(/^id[:\s]+(\w+)/i);
  if (match) return match[1];

  // Strategy 3: Look for patterns like "#12345" or "№12345"
  match = text.match(/[#№](\w+)/);
  if (match) return match[1];

  // Strategy 4: Look for salary accrual payment ID pattern (NP_xxx_NJ_xxx_PRLxxx)
  match = text.match(/NP_[A-Fa-f0-9]{6}_NJ_[A-Fa-f0-9]{6}_PRL\d{6}/);
  if (match) return match[0];

  // Strategy 5: If entire text is alphanumeric and reasonable length (5-50 chars), treat as payment_id
  if (/^[A-Z0-9-_]+$/i.test(text) && text.length >= 5 && text.length <= 50) {
    return text;
  }

  return null;
}
