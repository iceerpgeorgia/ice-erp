import { NextRequest, NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const revalidate = 0;

/* ── offset constants (same as [id]/route.ts) ── */
const BOG_USD_2_OFFSET = 300000000000n;
const BOG_USD_OFFSET = 500000000000n;
const BOG_EUR_OFFSET = 600000000000n;
const BOG_AED_OFFSET = 700000000000n;
const BOG_GBP_OFFSET = 800000000000n;
const BOG_KZT_OFFSET = 900000000000n;
const BOG_CNY_OFFSET = 950000000000n;
const BOG_TRY_OFFSET = 980000000000n;
const TBC_OFFSET = 1000000000000n;
const BATCH_OFFSET = 2000000000000n;

type AllowedTable =
  | "GE78BG0000000893486000_BOG_GEL"
  | "GE74BG0000000586388146_BOG_USD"
  | "GE78BG0000000893486000_BOG_USD"
  | "GE78BG0000000893486000_BOG_EUR"
  | "GE78BG0000000893486000_BOG_AED"
  | "GE78BG0000000893486000_BOG_GBP"
  | "GE78BG0000000893486000_BOG_KZT"
  | "GE78BG0000000893486000_BOG_CNY"
  | "GE78BG0000000893486000_BOG_TRY"
  | "GE65TB7856036050100002_TBC_GEL";

function resolveSyntheticId(
  rawId: bigint
): { tableName: AllowedTable; recordId: bigint; isBatch: boolean } | null {
  if (rawId < 0n) return null;

  const decode = (
    id: bigint,
    isBatch: boolean
  ): { tableName: AllowedTable; recordId: bigint; isBatch: boolean } => {
    if (id >= TBC_OFFSET)
      return { tableName: "GE65TB7856036050100002_TBC_GEL", recordId: id - TBC_OFFSET, isBatch };
    if (id >= BOG_TRY_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_TRY", recordId: id - BOG_TRY_OFFSET, isBatch };
    if (id >= BOG_CNY_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_CNY", recordId: id - BOG_CNY_OFFSET, isBatch };
    if (id >= BOG_KZT_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_KZT", recordId: id - BOG_KZT_OFFSET, isBatch };
    if (id >= BOG_GBP_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_GBP", recordId: id - BOG_GBP_OFFSET, isBatch };
    if (id >= BOG_AED_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_AED", recordId: id - BOG_AED_OFFSET, isBatch };
    if (id >= BOG_EUR_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_EUR", recordId: id - BOG_EUR_OFFSET, isBatch };
    if (id >= BOG_USD_OFFSET)
      return { tableName: "GE78BG0000000893486000_BOG_USD", recordId: id - BOG_USD_OFFSET, isBatch };
    if (id >= BOG_USD_2_OFFSET)
      return { tableName: "GE74BG0000000586388146_BOG_USD", recordId: id - BOG_USD_2_OFFSET, isBatch };
    return { tableName: "GE78BG0000000893486000_BOG_GEL", recordId: id, isBatch };
  };

  if (rawId >= BATCH_OFFSET) return decode(rawId - BATCH_OFFSET, true);
  return decode(rawId, false);
}

const normalizeDateToISO = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split(".");
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return null;
};

/**
 * Bulk-bind payment to multiple bank transactions in one request.
 * Replaces N individual PATCH /api/bank-transactions/[id] calls.
 *
 * Body: { ids: (number|string)[], payment_uuid: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ids, payment_uuid } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array is required" }, { status: 400 });
    }
    if (payment_uuid === undefined) {
      return NextResponse.json({ error: "payment_uuid is required" }, { status: 400 });
    }

    console.log(`[bulk-bind] Binding ${ids.length} transactions to payment ${payment_uuid}`);

    /* ── 1. Resolve synthetic IDs → table + real ID ── */
    type ResolvedEntry = {
      originalId: string;
      tableName: AllowedTable;
      recordId: bigint;
    };
    const resolved: ResolvedEntry[] = [];
    const batchSkipped: string[] = [];

    for (const id of ids) {
      const synth = resolveSyntheticId(BigInt(id));
      if (!synth) continue;
      if (synth.isBatch) {
        batchSkipped.push(String(id));
        continue;
      }
      resolved.push({
        originalId: String(id),
        tableName: synth.tableName,
        recordId: synth.recordId,
      });
    }

    if (resolved.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible transactions to update",
        updatedCount: 0,
        batchSkipped,
      });
    }

    /* ── 2. Group by table ── */
    const byTable = new Map<AllowedTable, ResolvedEntry[]>();
    for (const entry of resolved) {
      let list = byTable.get(entry.tableName);
      if (!list) {
        list = [];
        byTable.set(entry.tableName, list);
      }
      list.push(entry);
    }

    /* ── 3. Look up payment once ── */
    const normalizedPaymentId = payment_uuid || null;
    let paymentCurrencyUuid: string | null = null;
    let paymentCounteragentUuid: string | null = null;

    if (normalizedPaymentId) {
      const payment = await prisma.payments.findUnique({
        where: { payment_id: normalizedPaymentId },
        select: { currency_uuid: true, counteragent_uuid: true },
      });
      if (payment) {
        paymentCurrencyUuid = payment.currency_uuid;
        paymentCounteragentUuid = payment.counteragent_uuid;
      }
    }

    /* ── 4. Process each table ── */
    let totalUpdated = 0;

    for (const [tableName, entries] of byTable) {
      const recordIds = entries.map((e) => e.recordId);

      // Batch-fetch all rows in this table
      const placeholders = recordIds.map((_, i) => `$${i + 1}`).join(",");
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" WHERE id IN (${placeholders})`,
        ...recordIds
      );

      if (rows.length === 0) continue;

      if (normalizedPaymentId && paymentCurrencyUuid) {
        /* ── payment is being SET ── */

        // 4a. Collect unique effective dates
        const dateSet = new Set<string>();
        for (const row of rows) {
          const txISO = normalizeDateToISO(row.transaction_date);
          const corrISO = row.correction_date
            ? normalizeDateToISO(row.correction_date)
            : null;
          const effectiveDate =
            corrISO && corrISO !== txISO ? corrISO : txISO;
          if (effectiveDate) dateSet.add(effectiveDate);
        }

        // 4b. Batch-fetch NBG rates for all needed dates
        const dates = Array.from(dateSet);
        const ratesMap = new Map<string, any>();
        if (dates.length > 0) {
          const datePlaceholders = dates
            .map((_, i) => `$${i + 1}::date`)
            .join(",");
          const rateRows: any[] = await prisma.$queryRawUnsafe(
            `SELECT * FROM nbg_exchange_rates WHERE date IN (${datePlaceholders})`,
            ...dates
          );
          for (const r of rateRows) {
            const ds = new Date(r.date).toISOString().split("T")[0];
            ratesMap.set(ds, r);
          }
        }

        // 4c. Batch-fetch currency codes
        const currencyUuids = new Set<string>();
        currencyUuids.add(paymentCurrencyUuid);
        for (const row of rows) {
          if (row.account_currency_uuid)
            currencyUuids.add(row.account_currency_uuid);
        }
        const uuidArr = Array.from(currencyUuids);
        const currUuidPlaceholders = uuidArr
          .map((_, i) => `$${i + 1}::uuid`)
          .join(",");
        const currencyRows: Array<{ uuid: string; code: string }> =
          await prisma.$queryRawUnsafe(
            `SELECT uuid::text, code FROM currencies WHERE uuid IN (${currUuidPlaceholders})`,
            ...uuidArr
          );
        const codeOf = new Map<string, string>();
        for (const c of currencyRows) codeOf.set(c.uuid, c.code);

        const nominalCode = codeOf.get(paymentCurrencyUuid);
        const getRateField = (code: string) => `${code.toLowerCase()}_rate`;

        // 4d. Build per-row VALUES for the UPDATE
        const valueFragments: string[] = [];
        const valueParams: any[] = [];
        let pi = 1; // param index

        for (const row of rows) {
          const accountCode = codeOf.get(row.account_currency_uuid);

          let exchangeRate = new Decimal(1);
          let nominalAmount = new Decimal(
            row.account_currency_amount?.toString?.() ??
              row.account_currency_amount
          );

          if (
            accountCode &&
            nominalCode &&
            accountCode !== nominalCode
          ) {
            const txISO = normalizeDateToISO(row.transaction_date);
            const corrISO = row.correction_date
              ? normalizeDateToISO(row.correction_date)
              : null;
            const effectiveDate =
              corrISO && corrISO !== txISO ? corrISO : txISO;
            const rateData = effectiveDate
              ? ratesMap.get(effectiveDate)
              : null;

            if (rateData) {
              if (accountCode === "GEL") {
                const rate = rateData[getRateField(nominalCode)];
                if (rate) {
                  exchangeRate = new Decimal(rate.toString());
                  nominalAmount = new Decimal(
                    row.account_currency_amount.toString()
                  )
                    .mul(new Decimal(1).div(exchangeRate))
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                }
              } else if (nominalCode === "GEL") {
                const rate = rateData[getRateField(accountCode)];
                if (rate) {
                  exchangeRate = new Decimal(rate.toString());
                  nominalAmount = new Decimal(
                    row.account_currency_amount.toString()
                  )
                    .mul(exchangeRate)
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                }
              } else {
                // Foreign → Foreign cross rate
                const accountRate =
                  rateData[getRateField(accountCode)];
                const nominalRate =
                  rateData[getRateField(nominalCode)];
                if (accountRate && nominalRate) {
                  exchangeRate = new Decimal(
                    accountRate.toString()
                  ).div(new Decimal(nominalRate.toString()));
                  nominalAmount = new Decimal(
                    row.account_currency_amount.toString()
                  )
                    .mul(new Decimal(1).div(exchangeRate))
                    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
                }
              }
            }
          }

          // Auto-assign counteragent from payment if row has none
          const counteragentUuid =
            row.counteragent_uuid || paymentCounteragentUuid || null;

          valueFragments.push(
            `($${pi}::bigint, $${pi + 1}::numeric, $${pi + 2}::numeric, $${pi + 3}::uuid)`
          );
          valueParams.push(
            row.id,
            exchangeRate.toString(),
            nominalAmount.toString(),
            counteragentUuid
          );
          pi += 4;
        }

        // 4e. Single UPDATE … FROM (VALUES …)
        const updateQuery = `
          UPDATE "${tableName}" AS t
          SET payment_id       = $${pi},
              parsing_lock     = true,
              nominal_currency_uuid = $${pi + 1}::uuid,
              exchange_rate    = data.er,
              nominal_amount   = data.na,
              counteragent_uuid = data.ca,
              updated_at       = NOW()
          FROM (VALUES ${valueFragments.join(",")})
            AS data(id, er, na, ca)
          WHERE t.id = data.id
        `;
        valueParams.push(normalizedPaymentId, paymentCurrencyUuid);

        await prisma.$queryRawUnsafe(updateQuery, ...valueParams);
        totalUpdated += rows.length;
      } else {
        /* ── payment is being CLEARED ── */
        const clearPlaceholders = recordIds
          .map((_, i) => `$${i + 1}`)
          .join(",");
        await prisma.$queryRawUnsafe(
          `UPDATE "${tableName}"
           SET payment_id           = NULL,
               parsing_lock         = false,
               project_uuid         = NULL,
               financial_code_uuid  = NULL,
               nominal_currency_uuid = account_currency_uuid,
               exchange_rate        = 1,
               nominal_amount       = account_currency_amount,
               updated_at           = NOW()
           WHERE id IN (${clearPlaceholders})`,
          ...recordIds
        );
        totalUpdated += recordIds.length;
      }

      // Audit log per table (one entry instead of N)
      try {
        await logAudit({
          table: tableName as any,
          recordId: entries.map((e) => e.originalId).join(","),
          action: "update",
          changes: {
            bulkBind: true,
            payment_uuid: normalizedPaymentId,
            recordCount: entries.length,
          },
        });
      } catch (auditErr) {
        console.warn("[bulk-bind] Audit log failed (non-fatal):", auditErr);
      }
    }

    console.log(
      `[bulk-bind] ✓ Updated ${totalUpdated} transactions (${batchSkipped.length} batch partitions skipped)`
    );

    return NextResponse.json({
      success: true,
      message: `Updated ${totalUpdated} transactions`,
      updatedCount: totalUpdated,
      batchSkipped,
    });
  } catch (error: any) {
    console.error("[PATCH /api/bank-transactions/bulk-bind] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to bulk update transactions" },
      { status: 500 }
    );
  }
}
