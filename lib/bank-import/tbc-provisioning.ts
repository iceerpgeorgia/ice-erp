import { prisma } from "@/lib/prisma";

type ProvisionResult = {
  accountUuid: string;
  rawTableName: string;
  parsingSchemeUuid: string;
  parsingSchemeName: string;
  createdBankAccount: boolean;
  createdTable: boolean;
};

const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;

function assertSafeIdentifier(value: string, label: string): string {
  const cleaned = String(value || "").trim();
  if (!IDENTIFIER_RE.test(cleaned)) {
    throw new Error(`Unsafe ${label}: ${value}`);
  }
  return cleaned;
}

async function ensureParsingScheme(currencyCode: string): Promise<{ uuid: string; scheme: string }> {
  const normalized = String(currencyCode || "GEL").trim().toUpperCase();
  const scheme = `TBC_${normalized}`;

  const existing = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `SELECT uuid::text AS uuid FROM parsing_schemes WHERE scheme = $1 LIMIT 1`,
    scheme
  );

  if (existing[0]?.uuid) {
    return { uuid: existing[0].uuid, scheme };
  }

  const inserted = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `INSERT INTO parsing_schemes (scheme) VALUES ($1) RETURNING uuid::text AS uuid`,
    scheme
  );

  if (!inserted[0]?.uuid) {
    throw new Error(`Failed to create parsing scheme: ${scheme}`);
  }

  return { uuid: inserted[0].uuid, scheme };
}

async function resolveCurrencyUuid(currencyCode: string): Promise<string> {
  const normalized = String(currencyCode || "").trim().toUpperCase();
  const rows = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `SELECT uuid::text AS uuid FROM currencies WHERE UPPER(code) = $1 LIMIT 1`,
    normalized
  );

  if (!rows[0]?.uuid) {
    throw new Error(`Currency not found: ${normalized}`);
  }

  return rows[0].uuid;
}

async function resolveTbcBankUuid(): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `
      SELECT uuid::text AS uuid
      FROM banks
      WHERE UPPER(COALESCE(bank_name, '')) LIKE '%TBC%'
      ORDER BY CASE WHEN UPPER(bank_name) = 'TBC' THEN 0 ELSE 1 END, id
      LIMIT 1
    `
  );

  if (!rows[0]?.uuid) {
    throw new Error("TBC bank not found in banks table");
  }

  return rows[0].uuid;
}

async function resolveTemplateTbcTable(): Promise<string> {
  const preferred = "GE65TB7856036050100002_TBC_GEL";

  const preferredExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    preferred
  );

  if (preferredExists[0]?.exists) {
    return preferred;
  }

  const fallback = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE '%_TBC_%'
      ORDER BY table_name
      LIMIT 1
    `
  );

  if (!fallback[0]?.table_name) {
    throw new Error("No existing TBC deconsolidated table found to clone structure from");
  }

  return fallback[0].table_name;
}

async function ensureTbcTable(rawTableName: string): Promise<boolean> {
  const safeTable = assertSafeIdentifier(rawTableName, "table name");

  const existsRows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
    safeTable
  );

  if (existsRows[0]?.exists) {
    return false;
  }

  const templateTable = assertSafeIdentifier(await resolveTemplateTbcTable(), "template table");
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "${safeTable}" (LIKE "${templateTable}" INCLUDING ALL)`
  );

  return true;
}

export async function ensureTbcAccountProvisioned(
  accountNumber: string,
  currencyCode: string
): Promise<ProvisionResult> {
  const normalizedAccount = String(accountNumber || "").trim().toUpperCase();
  const normalizedCurrency = String(currencyCode || "GEL").trim().toUpperCase();

  if (!normalizedAccount) {
    throw new Error("Account number is required for TBC provisioning");
  }

  const rawTableName = `${normalizedAccount}_TBC_${normalizedCurrency}`;
  const { uuid: parsingSchemeUuid, scheme: parsingSchemeName } = await ensureParsingScheme(normalizedCurrency);
  const currencyUuid = await resolveCurrencyUuid(normalizedCurrency);
  const tbcBankUuid = await resolveTbcBankUuid();

  const existingAccount = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
    `
      SELECT uuid::text AS uuid
      FROM bank_accounts
      WHERE account_number = $1
        AND currency_uuid::text = $2
      LIMIT 1
    `,
    normalizedAccount,
    currencyUuid
  );

  let accountUuid = existingAccount[0]?.uuid || null;
  let createdBankAccount = false;

  if (!accountUuid) {
    const insiderCandidate = await prisma.$queryRawUnsafe<Array<{ insider_uuid: string | null }>>(
      `
        SELECT insider_uuid::text AS insider_uuid
        FROM bank_accounts
        WHERE account_number = $1
          AND insider_uuid IS NOT NULL
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
      normalizedAccount
    );

    const insiderUuid = insiderCandidate[0]?.insider_uuid || null;

    const inserted = await prisma.$queryRawUnsafe<Array<{ uuid: string }>>(
      `
        INSERT INTO bank_accounts (
          account_number,
          currency_uuid,
          bank_uuid,
          parsing_scheme_uuid,
          raw_table_name,
          insider_uuid,
          created_at,
          updated_at,
          is_active
        ) VALUES (
          $1,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6::uuid,
          NOW(),
          NOW(),
          true
        )
        RETURNING uuid::text AS uuid
      `,
      normalizedAccount,
      currencyUuid,
      tbcBankUuid,
      parsingSchemeUuid,
      rawTableName,
      insiderUuid
    );

    accountUuid = inserted[0]?.uuid || null;
    createdBankAccount = true;
  }

  if (!accountUuid) {
    throw new Error(`Failed to provision bank account row for ${normalizedAccount} ${normalizedCurrency}`);
  }

  await prisma.$executeRawUnsafe(
    `
      UPDATE bank_accounts
      SET
        bank_uuid = COALESCE(bank_uuid, $2::uuid),
        parsing_scheme_uuid = COALESCE(parsing_scheme_uuid, $3::uuid),
        raw_table_name = COALESCE(raw_table_name, $4),
        updated_at = NOW()
      WHERE uuid::text = $1
    `,
    accountUuid,
    tbcBankUuid,
    parsingSchemeUuid,
    rawTableName
  );

  const createdTable = await ensureTbcTable(rawTableName);

  return {
    accountUuid,
    rawTableName,
    parsingSchemeUuid,
    parsingSchemeName,
    createdBankAccount,
    createdTable,
  };
}
