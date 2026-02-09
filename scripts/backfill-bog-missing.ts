import 'dotenv/config';
import { Client } from 'pg';
import {
  getSupabaseClient,
  loadCounteragents,
  loadParsingRules,
  loadPayments,
  loadNBGRates,
  loadCurrencyCache,
} from '../lib/bank-import/db-utils';
import {
  calculateNominalAmount,
  computeCaseDescription,
  processSingleRecord,
} from '../lib/bank-import/import_bank_xml_data_deconsolidated';

const TABLE_NAME = 'GE78BG0000000893486000_BOG_GEL';
const RAW_TABLE = 'bog_gel_raw_893486000';
const ACCOUNT_NUMBER = 'GE78BG0000000893486000';

const SELECT_COLUMNS =
  'id,uuid,dockey,docsenderinn,docbenefinn,doccoracct,docsenderacctno,docbenefacctno,docprodgroup,docnomination,docinformation,entrydbamt,entrycramt,account_currency_amount,account_currency_uuid,transaction_date,parsing_lock';

type ProcessingContext = {
  counteragentsMap: Map<string, any>;
  parsingRules: any[];
  paymentsMap: Map<string, any>;
  salaryBaseMap: Map<string, any>;
  salaryLatestMap: Map<string, any>;
  duplicatePaymentMap: Map<string, string>;
  nbgRatesMap: Map<string, any>;
  currencyCache: Map<string, string>;
};

async function loadContext(): Promise<ProcessingContext> {
  const supabase = getSupabaseClient();
  const [counteragentsMap, parsingRules, paymentsBundle, nbgRatesMap, currencyCache] = await Promise.all([
    loadCounteragents(supabase),
    loadParsingRules(supabase),
    loadPayments(supabase),
    loadNBGRates(supabase),
    loadCurrencyCache(supabase),
  ]);

  const { paymentsMap, salaryBaseMap, salaryLatestMap, duplicatePaymentMap } = paymentsBundle;

  return {
    counteragentsMap,
    parsingRules,
    paymentsMap,
    salaryBaseMap,
    salaryLatestMap,
    duplicatePaymentMap,
    nbgRatesMap,
    currencyCache,
  };
}

async function main() {
  const connectionString =
    process.env.DIRECT_DATABASE_URL ||
    process.env.REMOTE_DATABASE_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Database connection string not found in env');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const accountResult = await client.query(
      `SELECT uuid, currency_uuid, account_number
       FROM bank_accounts
       WHERE account_number = $1
       LIMIT 1`,
      [ACCOUNT_NUMBER]
    );

    if (accountResult.rows.length === 0) {
      throw new Error(`Bank account not found for ${ACCOUNT_NUMBER}`);
    }

    const accountUuid = accountResult.rows[0].uuid;
    const accountCurrencyUuid = accountResult.rows[0].currency_uuid;

    const insertQuery = `
      WITH missing AS (
        SELECT r.*
        FROM ${RAW_TABLE} r
        LEFT JOIN "${TABLE_NAME}" d
          ON r.dockey = d.dockey AND r.entriesid = d.entriesid
        WHERE d.dockey IS NULL
      ), max_id AS (
        SELECT COALESCE(MAX(id), 0) AS max_id FROM "${TABLE_NAME}"
      ), ins AS (
        INSERT INTO "${TABLE_NAME}" (
          id,
          uuid,
          import_date,
          created_at,
          updated_at,
          cancopydocument,
          canviewdocument,
          canprintdocument,
          isreval,
          docnomination,
          docinformation,
          docsrcamt,
          docsrcccy,
          docdstamt,
          docdstccy,
          dockey,
          docrecdate,
          docbranch,
          docdepartment,
          docprodgroup,
          docno,
          docvaluedate,
          docsendername,
          docsenderinn,
          docsenderacctno,
          docsenderbic,
          docactualdate,
          doccoracct,
          doccorbic,
          doccorbankname,
          entriesid,
          doccomment,
          ccyrate,
          entrypdate,
          entrydocno,
          entrylacct,
          entrylacctold,
          entrydbamt,
          entrydbamtbase,
          entrycramt,
          entrycramtbase,
          outbalance,
          entryamtbase,
          entrycomment,
          entrydepartment,
          entryacctpoint,
          docsenderbicname,
          docbenefname,
          docbenefinn,
          docbenefacctno,
          docbenefbic,
          docbenefbicname,
          docpayername,
          docpayerinn,
          import_batch_id,
          counteragent_processed,
          parsing_rule_processed,
          payment_id_processed,
          is_processed,
          counteragent_inn,
          applied_rule_id,
          processing_case,
          bank_account_uuid,
          raw_record_uuid,
          transaction_date,
          description,
          counteragent_uuid,
          counteragent_account_number,
          project_uuid,
          financial_code_uuid,
          payment_id,
          account_currency_uuid,
          account_currency_amount,
          nominal_currency_uuid,
          nominal_amount,
          correction_date,
          exchange_rate,
          parsing_lock
        )
        SELECT
          (SELECT max_id FROM max_id) + ROW_NUMBER() OVER (ORDER BY r.dockey, r.entriesid) AS id,
          r.uuid,
          NOW()::date,
          NOW(),
          NOW(),
          r.cancopydocument,
          r.canviewdocument,
          r.canprintdocument,
          r.isreval,
          r.docnomination,
          r.docinformation,
          r.docsrcamt,
          r.docsrcccy,
          r.docdstamt,
          r.docdstccy,
          r.dockey,
          r.docrecdate,
          r.docbranch,
          r.docdepartment,
          r.docprodgroup,
          r.docno,
          r.docvaluedate,
          r.docsendername,
          r.docsenderinn,
          r.docsenderacctno,
          r.docsenderbic,
          r.docactualdate,
          r.doccoracct,
          r.doccorbic,
          r.doccorbankname,
          r.entriesid,
          r.doccomment,
          r.ccyrate,
          r.entrypdate,
          r.entrydocno,
          r.entrylacct,
          r.entrylacctold,
          r.entrydbamt,
          r.entrydbamtbase,
          r.entrycramt,
          r.entrycramtbase,
          r.outbalance,
          r.entryamtbase,
          r.entrycomment,
          r.entrydepartment,
          r.entryacctpoint,
          r.docsenderbicname,
          r.docbenefname,
          r.docbenefinn,
          r.docbenefacctno,
          r.docbenefbic,
          r.docbenefbicname,
          r.docpayername,
          r.docpayerinn,
          r.import_batch_id,
          false,
          false,
          false,
          false,
          null,
          null,
          null,
          $1::uuid,
          r.uuid,
          COALESCE(
            CASE
              WHEN r.docvaluedate IS NULL THEN NULL
              WHEN LEFT(r.docvaluedate::text, 10) ~ '^\d{2}\.\d{2}\.\d{4}$' THEN to_date(LEFT(r.docvaluedate::text, 10), 'DD.MM.YYYY')
              WHEN LEFT(r.docvaluedate::text, 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(LEFT(r.docvaluedate::text, 10), 'YYYY-MM-DD')
              WHEN LEFT(r.docvaluedate::text, 8) ~ '^\d{8}$' THEN to_date(LEFT(r.docvaluedate::text, 8), 'YYYYMMDD')
              ELSE NULL
            END,
            CASE
              WHEN r.docrecdate IS NULL THEN NULL
              WHEN LEFT(r.docrecdate::text, 10) ~ '^\d{2}\.\d{2}\.\d{4}$' THEN to_date(LEFT(r.docrecdate::text, 10), 'DD.MM.YYYY')
              WHEN LEFT(r.docrecdate::text, 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(LEFT(r.docrecdate::text, 10), 'YYYY-MM-DD')
              WHEN LEFT(r.docrecdate::text, 8) ~ '^\d{8}$' THEN to_date(LEFT(r.docrecdate::text, 8), 'YYYYMMDD')
              ELSE NULL
            END,
            CASE
              WHEN r.docactualdate IS NULL THEN NULL
              WHEN LEFT(r.docactualdate::text, 10) ~ '^\d{2}\.\d{2}\.\d{4}$' THEN to_date(LEFT(r.docactualdate::text, 10), 'DD.MM.YYYY')
              WHEN LEFT(r.docactualdate::text, 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(LEFT(r.docactualdate::text, 10), 'YYYY-MM-DD')
              WHEN LEFT(r.docactualdate::text, 8) ~ '^\d{8}$' THEN to_date(LEFT(r.docactualdate::text, 8), 'YYYYMMDD')
              ELSE NULL
            END,
            CASE
              WHEN r.entrypdate IS NULL THEN NULL
              WHEN LEFT(r.entrypdate::text, 10) ~ '^\d{2}\.\d{2}\.\d{4}$' THEN to_date(LEFT(r.entrypdate::text, 10), 'DD.MM.YYYY')
              WHEN LEFT(r.entrypdate::text, 10) ~ '^\d{4}-\d{2}-\d{2}$' THEN to_date(LEFT(r.entrypdate::text, 10), 'YYYY-MM-DD')
              WHEN LEFT(r.entrypdate::text, 8) ~ '^\d{8}$' THEN to_date(LEFT(r.entrypdate::text, 8), 'YYYYMMDD')
              ELSE NULL
            END,
            CURRENT_DATE
          ),
          r.docnomination,
          null,
          null,
          null,
          null,
          null,
          $2::uuid,
          (COALESCE(r.entrycramt, '0')::numeric - COALESCE(r.entrydbamt, '0')::numeric),
          $2::uuid,
          (COALESCE(r.entrycramt, '0')::numeric - COALESCE(r.entrydbamt, '0')::numeric),
          null,
          CASE WHEN r.ccyrate ~ '^[0-9]+(\\.[0-9]+)?$' THEN r.ccyrate::numeric ELSE NULL END,
          false
        FROM missing r
        RETURNING id
      )
      SELECT id FROM ins
    `;

    const inserted = await client.query(insertQuery, [accountUuid, accountCurrencyUuid]);
    const insertedIds = inserted.rows.map((row) => row.id as number);

    console.log(`Inserted ${insertedIds.length} missing rows into ${TABLE_NAME}.`);

    if (insertedIds.length === 0) {
      const pendingResult = await client.query(
        `SELECT id FROM "${TABLE_NAME}"
         WHERE processing_case IS NULL
           AND counteragent_processed = false
           AND parsing_rule_processed = false
           AND payment_id_processed = false`
      );
      insertedIds.push(...pendingResult.rows.map((row) => row.id as number));
      console.log(`Found ${insertedIds.length} rows pending backparse.`);
    }

    if (insertedIds.length === 0) {
      return;
    }

    const context = await loadContext();

    const updateChunkSize = 200;
    const selectChunkSize = 500;
    let updatedTotal = 0;

    for (let i = 0; i < insertedIds.length; i += selectChunkSize) {
      const chunk = insertedIds.slice(i, i + selectChunkSize);
      const selectResult = await client.query(
        `SELECT ${SELECT_COLUMNS} FROM "${TABLE_NAME}" WHERE id = ANY($1::int[])`,
        [chunk]
      );
      const rows = selectResult.rows || [];

      const updateRows = rows.map((row: any, idx: number) => {
        const inputRow = {
          ...row,
          doccorracct: row.doccoracct ?? null,
          debit: row.entrydbamt ? Number(row.entrydbamt) : 0,
        };

        const result = processSingleRecord(
          inputRow,
          context.counteragentsMap,
          context.parsingRules,
          context.paymentsMap,
          context.salaryBaseMap,
          context.salaryLatestMap,
          context.duplicatePaymentMap,
          idx + 1,
          {
            case1_counteragent_processed: 0,
            case2_counteragent_inn_blank: 0,
            case3_counteragent_inn_nonblank_no_match: 0,
            case4_payment_id_match: 0,
            case5_payment_id_counteragent_mismatch: 0,
            case6_parsing_rule_match: 0,
            case7_parsing_rule_counteragent_mismatch: 0,
            case8_parsing_rule_dominance: 0,
          },
          new Map()
        );

        const accountCurrencyUuidRow = row.account_currency_uuid;
        const accountCurrencyCode = accountCurrencyUuidRow
          ? context.currencyCache.get(accountCurrencyUuidRow)
          : null;
        const nominalCurrencyUuid = result.nominal_currency_uuid || accountCurrencyUuidRow || null;
        const transactionDate = row.transaction_date ? new Date(row.transaction_date) : null;

        const nominalAmount =
          transactionDate && accountCurrencyCode && nominalCurrencyUuid
            ? calculateNominalAmount(
                Number(row.account_currency_amount || 0),
                accountCurrencyCode,
                nominalCurrencyUuid,
                transactionDate,
                context.nbgRatesMap,
                context.currencyCache
              )
            : Number(row.account_currency_amount || 0);

        const caseDescription = computeCaseDescription(
          result.case1_counteragent_processed,
          false,
          result.case3_counteragent_missing,
          result.case4_payment_id_matched,
          result.case5_payment_id_conflict,
          result.case6_parsing_rule_applied,
          result.case7_parsing_rule_conflict,
          false,
          result.applied_rule_id
        );

        return {
          id: row.id,
          counteragent_processed: result.case1_counteragent_processed,
          parsing_rule_processed: result.case6_parsing_rule_applied,
          payment_id_processed: result.case4_payment_id_matched,
          is_processed: Boolean(
            result.case1_counteragent_processed &&
              result.case6_parsing_rule_applied &&
              result.case4_payment_id_matched
          ),
          counteragent_inn: result.counteragent_inn,
          applied_rule_id: result.applied_rule_id,
          processing_case: caseDescription,
          counteragent_uuid: result.counteragent_uuid,
          counteragent_account_number: result.counteragent_account_number,
          project_uuid: result.project_uuid,
          financial_code_uuid: result.financial_code_uuid,
          payment_id: result.payment_id,
          nominal_currency_uuid: nominalCurrencyUuid,
          nominal_amount: nominalAmount,
        };
      });

      for (let j = 0; j < updateRows.length; j += updateChunkSize) {
        const updateChunk = updateRows.slice(j, j + updateChunkSize);
        if (updateChunk.length === 0) continue;

        const values: any[] = [];
        const rowsSql = updateChunk
          .map((row, idx) => {
            const baseIndex = idx * 15;
            values.push(
              row.id,
              row.counteragent_processed,
              row.parsing_rule_processed,
              row.payment_id_processed,
              row.is_processed,
              row.counteragent_inn,
              row.applied_rule_id,
              row.processing_case,
              row.counteragent_uuid,
              row.counteragent_account_number,
              row.project_uuid,
              row.financial_code_uuid,
              row.payment_id,
              row.nominal_currency_uuid,
              row.nominal_amount
            );
            const params = Array.from({ length: 15 }, (_, paramIdx) => `$${baseIndex + paramIdx + 1}`);
            return `(${params.join(', ')})`;
          })
          .join(', ');

        const updateSql = `
          UPDATE "${TABLE_NAME}" AS t
          SET
            counteragent_processed = v.counteragent_processed::boolean,
            parsing_rule_processed = v.parsing_rule_processed::boolean,
            payment_id_processed = v.payment_id_processed::boolean,
            is_processed = v.is_processed::boolean,
            counteragent_inn = v.counteragent_inn,
            applied_rule_id = v.applied_rule_id::int,
            processing_case = v.processing_case,
            counteragent_uuid = v.counteragent_uuid::uuid,
            counteragent_account_number = v.counteragent_account_number,
            project_uuid = v.project_uuid::uuid,
            financial_code_uuid = v.financial_code_uuid::uuid,
            payment_id = v.payment_id,
            nominal_currency_uuid = v.nominal_currency_uuid::uuid,
            nominal_amount = v.nominal_amount::numeric
          FROM (VALUES ${rowsSql}) AS v(
            id,
            counteragent_processed,
            parsing_rule_processed,
            payment_id_processed,
            is_processed,
            counteragent_inn,
            applied_rule_id,
            processing_case,
            counteragent_uuid,
            counteragent_account_number,
            project_uuid,
            financial_code_uuid,
            payment_id,
            nominal_currency_uuid,
            nominal_amount
          )
          WHERE t.id = v.id::bigint
        `;

        await client.query(updateSql, values);
        updatedTotal += updateChunk.length;
      }
    }

    console.log(`Backparse complete. Updated ${updatedTotal} rows.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
