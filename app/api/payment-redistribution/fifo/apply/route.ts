import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const revalidate = 0;
export const dynamic = "force-dynamic";

const ALLOWED_TABLES = new Set([
  "GE78BG0000000893486000_BOG_GEL",
  "GE65TB7856036050100002_TBC_GEL",
]);

const formatBatchId = (uuid: string) => {
  const compact = uuid.replace(/-/g, "").toUpperCase();
  const part1 = compact.slice(0, 6);
  const part2 = compact.slice(6, 8);
  const part3 = compact.slice(8, 14);
  return `BTC_${part1}_${part2}_${part3}`;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updates = Array.isArray(body.updates) ? body.updates : [];
    const batches = Array.isArray(body.batches) ? body.batches : [];

    if (updates.length === 0 && batches.length === 0) {
      return NextResponse.json(
        { error: "No updates or batches provided." },
        { status: 400 }
      );
    }

    const updateQueries = updates.map((update: any) => {
      if (!ALLOWED_TABLES.has(update.source_table)) {
        throw new Error(`Unsupported source table: ${update.source_table}`);
      }
      return prisma.$executeRawUnsafe(
        `UPDATE "${update.source_table}"
         SET payment_id = $1,
             parsing_lock = true,
             updated_at = NOW()
         WHERE id = $2`,
        update.to_payment_id,
        BigInt(update.id)
      );
    });

    const batchAssignments: Array<{ source_table: string; id: number; batch_id: string }> = [];

    for (const batch of batches) {
      if (!ALLOWED_TABLES.has(batch.source_table)) {
        throw new Error(`Unsupported source table: ${batch.source_table}`);
      }
      if (!batch.raw_record_uuid || !batch.bank_account_uuid || !batch.raw_record_id_1 || !batch.raw_record_id_2) {
        throw new Error(`Missing raw record identifiers for ${batch.source_table}:${batch.id}`);
      }
      if (!Array.isArray(batch.partitions) || batch.partitions.length === 0) {
        throw new Error(`Missing partitions for ${batch.source_table}:${batch.id}`);
      }

      const batchUuid = crypto.randomUUID();
      const batchId = formatBatchId(batchUuid);

      await prisma.$executeRawUnsafe(
        `DELETE FROM bank_transaction_batches WHERE raw_record_uuid::text = $1::text`,
        batch.raw_record_uuid
      );

      const insertQueries = batch.partitions.map((partition: any, index: number) => {
        const safePartitionAmount = Math.abs(Number(partition.partition_amount || 0));
        const safeNominalAmount =
          partition.nominal_amount !== null && partition.nominal_amount !== undefined
            ? Math.abs(Number(partition.nominal_amount))
            : null;

        return prisma.$queryRawUnsafe(
          `
          INSERT INTO bank_transaction_batches (
            bank_account_uuid,
            raw_record_id_1,
            raw_record_id_2,
            raw_record_uuid,
            batch_id,
            batch_uuid,
            partition_amount,
            partition_sequence,
            payment_uuid,
            payment_id,
            counteragent_uuid,
            project_uuid,
            financial_code_uuid,
            nominal_currency_uuid,
            nominal_amount,
            partition_note
          ) VALUES (
            $1::uuid,
            $2,
            $3,
            $4,
            $5,
            $6::uuid,
            $7,
            $8,
            $9::uuid,
            $10,
            $11::uuid,
            $12::uuid,
            $13::uuid,
            $14::uuid,
            $15,
            $16
          )
        `,
          batch.bank_account_uuid,
          batch.raw_record_id_1,
          batch.raw_record_id_2,
          batch.raw_record_uuid,
          batchId,
          batchUuid,
          safePartitionAmount,
          index + 1,
          partition.payment_uuid || null,
          partition.payment_id || null,
          partition.counteragent_uuid || null,
          partition.project_uuid || null,
          partition.financial_code_uuid || null,
          partition.nominal_currency_uuid || null,
          safeNominalAmount,
          partition.partition_note || null
        );
      });

      await prisma.$transaction(insertQueries);

      await prisma.$executeRawUnsafe(
        `UPDATE "${batch.source_table}"
         SET payment_id = $1,
             parsing_lock = true,
             updated_at = NOW()
         WHERE raw_record_uuid::text = $2::text`,
        batchId,
        batch.raw_record_uuid
      );

      batchAssignments.push({
        source_table: batch.source_table,
        id: Number(batch.id),
        batch_id: batchId,
      });
    }

    if (updateQueries.length > 0) {
      await prisma.$transaction(updateQueries);
    }

    return NextResponse.json({
      updated: updateQueries.length,
      batchesCreated: batchAssignments.length,
      batchAssignments,
    });
  } catch (error: any) {
    console.error("POST /api/payment-redistribution/fifo/apply failed:", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
