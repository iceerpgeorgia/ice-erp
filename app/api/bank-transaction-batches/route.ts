import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSourceTables } from '@/lib/source-tables';

const formatBatchId = (uuid: string) => {
  const compact = uuid.replace(/-/g, '').toUpperCase();
  const part1 = compact.slice(0, 6);
  const part2 = compact.slice(6, 8);
  const part3 = compact.slice(8, 14);
  return `BTC_${part1}_${part2}_${part3}`;
};

export async function GET(request: NextRequest) {
  try {
    const sourceTables = await getSourceTables();
    const { searchParams } = new URL(request.url);
    const batchUuid = searchParams.get('batchUuid');
    const batchId = searchParams.get('batchId');
    const rawRecordUuid = searchParams.get('rawRecordUuid');
    
    if (batchUuid) {
      // Get specific batch with all partitions
      const partitions = await prisma.$queryRawUnsafe(`
        SELECT 
          btb.id,
          btb.uuid,
          btb.batch_id,
          btb.batch_uuid,
          btb.partition_amount,
          btb.partition_sequence,
          btb.payment_uuid,
          btb.payment_id,
          btb.counteragent_uuid,
          btb.project_uuid,
          btb.financial_code_uuid,
          btb.nominal_currency_uuid,
          btb.nominal_amount,
          btb.partition_note,
          p.payment_id as payment_identifier,
          c.counteragent as counteragent_name,
          proj.project_index,
          fc.validation as financial_code,
          curr.code as currency_code
        FROM bank_transaction_batches btb
        LEFT JOIN payments p ON btb.payment_uuid = p.record_uuid
        LEFT JOIN counteragents c ON btb.counteragent_uuid = c.counteragent_uuid
        LEFT JOIN projects proj ON btb.project_uuid = proj.project_uuid
        LEFT JOIN financial_codes fc ON btb.financial_code_uuid = fc.uuid
        LEFT JOIN currencies curr ON btb.nominal_currency_uuid = curr.uuid
        WHERE btb.batch_uuid = $1::uuid
        ORDER BY btb.partition_sequence
      `, batchUuid) as any[];

      const mappedPartitions = partitions.map((partition) => ({
        ...partition,
        id: partition.id !== null && partition.id !== undefined ? Number(partition.id) : null,
        partition_sequence:
          partition.partition_sequence !== null && partition.partition_sequence !== undefined
            ? Number(partition.partition_sequence)
            : null,
        partition_amount:
          partition.partition_amount !== null && partition.partition_amount !== undefined
            ? Number(partition.partition_amount)
            : null,
        nominal_amount:
          partition.nominal_amount !== null && partition.nominal_amount !== undefined
            ? Number(partition.nominal_amount)
            : null,
      }));

      return NextResponse.json({
        batchUuid,
        batchId: formatBatchId(batchUuid),
        partitions: mappedPartitions,
      });
    }

    if (batchId) {
      const partitions = await prisma.$queryRawUnsafe(`
        SELECT 
          btb.id,
          btb.uuid,
          btb.batch_id,
          btb.batch_uuid,
          btb.partition_amount,
          btb.partition_sequence,
          btb.payment_uuid,
          btb.payment_id,
          btb.counteragent_uuid,
          btb.project_uuid,
          btb.financial_code_uuid,
          btb.nominal_currency_uuid,
          btb.nominal_amount,
          btb.partition_note,
          p.payment_id as payment_identifier,
          c.counteragent as counteragent_name,
          proj.project_index,
          fc.validation as financial_code,
          curr.code as currency_code
        FROM bank_transaction_batches btb
        LEFT JOIN payments p ON btb.payment_uuid = p.record_uuid
        LEFT JOIN counteragents c ON btb.counteragent_uuid = c.counteragent_uuid
        LEFT JOIN projects proj ON btb.project_uuid = proj.project_uuid
        LEFT JOIN financial_codes fc ON btb.financial_code_uuid = fc.uuid
        LEFT JOIN currencies curr ON btb.nominal_currency_uuid = curr.uuid
        WHERE btb.batch_id = $1
        ORDER BY btb.partition_sequence
      `, batchId) as any[];

      const mappedPartitions = partitions.map((partition) => ({
        ...partition,
        id: partition.id !== null && partition.id !== undefined ? Number(partition.id) : null,
        partition_sequence:
          partition.partition_sequence !== null && partition.partition_sequence !== undefined
            ? Number(partition.partition_sequence)
            : null,
        partition_amount:
          partition.partition_amount !== null && partition.partition_amount !== undefined
            ? Number(partition.partition_amount)
            : null,
        nominal_amount:
          partition.nominal_amount !== null && partition.nominal_amount !== undefined
            ? Number(partition.nominal_amount)
            : null,
      }));

      const batchUuidValue = partitions[0]?.batch_uuid ?? null;

      return NextResponse.json({
        batchUuid: batchUuidValue,
        batchId,
        partitions: mappedPartitions,
      });
    }
    
    if (rawRecordUuid) {
      // Check if raw record already has batches
      const batches = await prisma.$queryRawUnsafe(`
        SELECT
          batch_uuid,
          COUNT(*) as partition_count,
          SUM(partition_amount) as total_amount,
          ARRAY_AGG(payment_id ORDER BY partition_sequence) as payment_ids
        FROM bank_transaction_batches
        WHERE raw_record_uuid::text = $1::text
        GROUP BY batch_uuid
      `, rawRecordUuid) as any[];

      const mapped = batches.map((batch) => ({
        batchUuid: batch.batch_uuid,
        batchId: formatBatchId(batch.batch_uuid),
        partitionCount: Number(batch.partition_count || 0),
        totalAmount: batch.total_amount ? Number(batch.total_amount) : 0,
        paymentIds: batch.payment_ids || [],
      }));

      return NextResponse.json({
        hasBatch: mapped.length > 0,
        batchCount: mapped.length,
        batches: mapped,
      });
    }
    
    // Get all batches summary
    const batches = await prisma.$queryRawUnsafe(`
      WITH raw_union AS (
        ${sourceTables.map((table) => `SELECT raw_record_uuid, docnomination, docvaluedate FROM "${table}"`).join(' UNION ALL ')}
      ),
      payment_breakdown AS (
        SELECT
          batch_uuid,
          json_agg(
            json_build_object(
              'paymentId', payment_id,
              'amount', total_amount,
              'count', partition_count
            )
            ORDER BY payment_id
          ) as payment_breakdown
        FROM (
          SELECT
            batch_uuid,
            payment_id,
            SUM(partition_amount) as total_amount,
            COUNT(*) as partition_count
          FROM bank_transaction_batches
          GROUP BY batch_uuid, payment_id
        ) grouped
        GROUP BY batch_uuid
      )
      SELECT
        btb.batch_uuid,
        MIN(btb.bank_account_uuid) as bank_account_uuid,
        MIN(btb.raw_record_id_1) as raw_record_id_1,
        MIN(btb.raw_record_id_2) as raw_record_id_2,
        MIN(btb.raw_record_uuid) as raw_record_uuid,
        COUNT(*) as partition_count,
        SUM(btb.partition_amount) as total_partition_amount,
        ARRAY_AGG(btb.payment_id ORDER BY btb.partition_sequence) as payment_ids,
        MIN(btb.created_at) as created_at,
        raw.docnomination,
        raw.docvaluedate,
        pb.payment_breakdown
      FROM bank_transaction_batches btb
      LEFT JOIN raw_union raw
        ON raw.raw_record_uuid::text = btb.raw_record_uuid::text
      LEFT JOIN payment_breakdown pb
        ON pb.batch_uuid = btb.batch_uuid
      GROUP BY btb.batch_uuid, raw.docnomination, raw.docvaluedate, pb.payment_breakdown
      ORDER BY MIN(btb.created_at) DESC
      LIMIT 200
    `) as any[];

    const mapped = batches.map((batch) => ({
      batchUuid: batch.batch_uuid,
      batchId: formatBatchId(batch.batch_uuid),
      bankAccountUuid: batch.bank_account_uuid,
      rawRecordId1: batch.raw_record_id_1,
      rawRecordId2: batch.raw_record_id_2,
      rawRecordUuid: batch.raw_record_uuid,
      partitionCount: Number(batch.partition_count || 0),
      totalAmount: batch.total_partition_amount ? Number(batch.total_partition_amount) : 0,
      paymentIds: batch.payment_ids || [],
      paymentBreakdown: batch.payment_breakdown || [],
      createdAt: batch.created_at,
      docnomination: batch.docnomination || null,
      docvaluedate: batch.docvaluedate || null,
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const sourceTables = await getSourceTables();
    const body = await request.json();
    const { 
      bankAccountUuid, 
      rawRecordId1, 
      rawRecordId2, 
      rawRecordUuid,
      replaceBatchUuid,
      partitions 
    } = body;

    // Validation
    if (!bankAccountUuid || !rawRecordId1 || !rawRecordId2 || !rawRecordUuid || !partitions || partitions.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (partitions.length < 2) {
      return NextResponse.json(
        { error: 'Batch must have at least 2 partitions' },
        { status: 400 }
      );
    }

    // When not replacing, check for existing batches
    if (!replaceBatchUuid) {
      const existingBatches = await prisma.$queryRawUnsafe<Array<{ batch_id: string }>>(
        `SELECT DISTINCT batch_id FROM bank_transaction_batches WHERE raw_record_uuid::text = $1::text`,
        rawRecordUuid
      );

      if (existingBatches.length > 0) {
        return NextResponse.json(
          {
            error: 'Batch already exists for this transaction.',
            batchIds: existingBatches.map((row) => row.batch_id),
          },
          { status: 409 }
        );
      }
    }

    // Generate batch UUID
    const batchUuidResult = await prisma.$queryRawUnsafe(`SELECT gen_random_uuid()::text as uuid`) as any[];
    const newBatchUuid = batchUuidResult[0].uuid;
    const batchId = formatBatchId(newBatchUuid);

    await prisma.$transaction(async (tx) => {
      // If replacing, delete old batch partitions first (atomic)
      if (replaceBatchUuid) {
        await tx.$executeRawUnsafe(
          `DELETE FROM bank_transaction_batches WHERE batch_uuid = $1::uuid`,
          replaceBatchUuid
        );
      }

      // Insert partitions one-by-one with parameterized queries
      for (let index = 0; index < partitions.length; index++) {
        const partition = partitions[index];
        const safePartitionAmount = Math.abs(Number(partition.partitionAmount));
        const safeNominalAmount =
          partition.nominalAmount !== null && partition.nominalAmount !== undefined
            ? Math.abs(Number(partition.nominalAmount))
            : null;

        await tx.$executeRawUnsafe(
          `INSERT INTO bank_transaction_batches (
            bank_account_uuid, raw_record_id_1, raw_record_id_2, raw_record_uuid,
            batch_id, batch_uuid, partition_amount, partition_sequence,
            payment_uuid, payment_id, counteragent_uuid, project_uuid,
            financial_code_uuid, nominal_currency_uuid, nominal_amount, partition_note
          ) VALUES (
            $1::uuid, $2, $3, $4::uuid,
            $5, $6::uuid, $7, $8,
            $9::uuid, $10, $11::uuid, $12::uuid,
            $13::uuid, $14::uuid, $15, $16
          )`,
          bankAccountUuid,
          rawRecordId1,
          rawRecordId2,
          rawRecordUuid,
          batchId,
          newBatchUuid,
          safePartitionAmount,
          index + 1,
          partition.paymentUuid || null,
          partition.paymentId || null,
          partition.counteragentUuid || null,
          partition.projectUuid || null,
          partition.financialCodeUuid || null,
          partition.nominalCurrencyUuid || null,
          safeNominalAmount,
          partition.partitionNote || null
        );
      }

      await Promise.all(
        sourceTables.map((table) =>
          tx.$executeRawUnsafe(
            `UPDATE "${table}" SET payment_id = $1, parsing_lock = true, updated_at = NOW() WHERE raw_record_uuid::text = $2::text`,
            batchId,
            rawRecordUuid
          )
        )
      );
    });

    return NextResponse.json({ 
      success: true, 
      batchUuid: newBatchUuid,
      batchId,
    });
  } catch (error: any) {
    console.error('Error creating batch:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create batch' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const sourceTables = await getSourceTables();
    const { searchParams } = new URL(request.url);
    const batchUuid = searchParams.get('batchUuid');
    const partitionUuid = searchParams.get('partitionUuid');
    const paymentId = searchParams.get('paymentId');
    const paymentUuid = searchParams.get('paymentUuid');
    const rawRecordUuid = searchParams.get('rawRecordUuid');

    const getAffectedRawRecordUuids = async (): Promise<string[]> => {
      if (batchUuid) {
        const rows = await prisma.$queryRawUnsafe<Array<{ raw_record_uuid: string | null }>>(
          `SELECT DISTINCT raw_record_uuid::text as raw_record_uuid FROM bank_transaction_batches WHERE batch_uuid = $1`,
          batchUuid
        );
        return rows.map((row) => row.raw_record_uuid).filter((value): value is string => Boolean(value));
      }

      if (partitionUuid) {
        const rows = await prisma.$queryRawUnsafe<Array<{ raw_record_uuid: string | null }>>(
          `SELECT DISTINCT raw_record_uuid::text as raw_record_uuid FROM bank_transaction_batches WHERE uuid = $1`,
          partitionUuid
        );
        return rows.map((row) => row.raw_record_uuid).filter((value): value is string => Boolean(value));
      }

      if (paymentId) {
        const rows = await prisma.$queryRawUnsafe<Array<{ raw_record_uuid: string | null }>>(
          `SELECT DISTINCT raw_record_uuid::text as raw_record_uuid
           FROM bank_transaction_batches
           WHERE payment_id = $1`,
          paymentId
        );
        return rows.map((row) => row.raw_record_uuid).filter((value): value is string => Boolean(value));
      }

      if (paymentUuid) {
        const rows = await prisma.$queryRawUnsafe<Array<{ raw_record_uuid: string | null }>>(
          `SELECT DISTINCT raw_record_uuid::text as raw_record_uuid
           FROM bank_transaction_batches
           WHERE payment_uuid = $1::uuid`,
          paymentUuid
        );
        return rows.map((row) => row.raw_record_uuid).filter((value): value is string => Boolean(value));
      }

      if (rawRecordUuid) {
        return [rawRecordUuid];
      }

      return [];
    };

    const getFallbackCounteragentMap = async (affectedRawRecordUuids: string[]) => {
      if (affectedRawRecordUuids.length === 0) return new Map<string, string>();

      const rows = await prisma.$queryRawUnsafe<
        Array<{ raw_record_uuid: string; counteragent_uuid: string | null }>
      >(
        `SELECT
           btb.raw_record_uuid::text as raw_record_uuid,
           COALESCE(MAX(btb.counteragent_uuid)::text, MAX(p.counteragent_uuid)::text) as counteragent_uuid
         FROM bank_transaction_batches btb
         LEFT JOIN payments p ON p.record_uuid = btb.payment_uuid
         WHERE btb.raw_record_uuid::text = ANY($1::text[])
         GROUP BY btb.raw_record_uuid::text`,
        affectedRawRecordUuids
      );

      const map = new Map<string, string>();
      rows.forEach((row) => {
        if (row.raw_record_uuid && row.counteragent_uuid) {
          map.set(row.raw_record_uuid, row.counteragent_uuid);
        }
      });
      return map;
    };

    const cleanupRawBatchMarkers = async (
      affectedRawRecordUuids: string[],
      fallbackCounteragentByRawUuid: Map<string, string>
    ) => {
      for (const uuid of affectedRawRecordUuids) {
        const remaining = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
          `SELECT COUNT(*)::bigint as cnt
           FROM bank_transaction_batches
           WHERE raw_record_uuid::text = $1::text`,
          uuid
        );
        const remainingCount = Number(remaining[0]?.cnt ?? 0n);
        if (remainingCount > 0) continue;

        const fallbackCounteragentUuid = fallbackCounteragentByRawUuid.get(uuid) ?? null;

        await Promise.all(
          sourceTables.map((table) =>
            fallbackCounteragentUuid
              ? prisma.$executeRawUnsafe(
                  `UPDATE "${table}"
                   SET payment_id = NULL,
                       parsing_lock = false,
                       counteragent_uuid = COALESCE(counteragent_uuid, $2::uuid),
                       updated_at = NOW()
                   WHERE raw_record_uuid::text = $1::text
                     AND payment_id ILIKE 'BTC_%'`,
                  uuid,
                  fallbackCounteragentUuid
                )
              : prisma.$executeRawUnsafe(
                  `UPDATE "${table}"
                   SET payment_id = NULL,
                       parsing_lock = false,
                       updated_at = NOW()
                   WHERE raw_record_uuid::text = $1::text
                     AND payment_id ILIKE 'BTC_%'`,
                  uuid
                )
          )
        );
      }
    };

    const affectedRawRecordUuids = await getAffectedRawRecordUuids();
    const fallbackCounteragentByRawUuid = await getFallbackCounteragentMap(affectedRawRecordUuids);

    if (batchUuid) {
      // Delete entire batch
      await prisma.$executeRawUnsafe(
        `DELETE FROM bank_transaction_batches WHERE batch_uuid = $1::uuid`,
        batchUuid
      );
      await cleanupRawBatchMarkers(affectedRawRecordUuids, fallbackCounteragentByRawUuid);
      return NextResponse.json({ success: true });
    }
    
    if (partitionUuid) {
      // Delete single partition
      await prisma.$executeRawUnsafe(
        `DELETE FROM bank_transaction_batches WHERE uuid = $1::uuid`,
        partitionUuid
      );
      await cleanupRawBatchMarkers(affectedRawRecordUuids, fallbackCounteragentByRawUuid);
      return NextResponse.json({ success: true });
    }

    if (paymentId) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE payment_id = ${paymentId}
      `;
      await cleanupRawBatchMarkers(affectedRawRecordUuids, fallbackCounteragentByRawUuid);
      return NextResponse.json({ success: true });
    }

    if (paymentUuid) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE payment_uuid = ${paymentUuid}::uuid
      `;
      await cleanupRawBatchMarkers(affectedRawRecordUuids, fallbackCounteragentByRawUuid);
      return NextResponse.json({ success: true });
    }

    if (rawRecordUuid) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE raw_record_uuid::text = ${rawRecordUuid}::text
      `;
      await cleanupRawBatchMarkers(affectedRawRecordUuids, fallbackCounteragentByRawUuid);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Missing batchUuid, partitionUuid, paymentId, paymentUuid, or rawRecordUuid' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error deleting batch:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    );
  }
}
