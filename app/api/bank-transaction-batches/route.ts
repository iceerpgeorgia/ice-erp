import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const SOURCE_TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const formatBatchId = (uuid: string) => {
  const compact = uuid.replace(/-/g, '').toUpperCase();
  const part1 = compact.slice(0, 6);
  const part2 = compact.slice(6, 8);
  const part3 = compact.slice(8, 14);
  return `BTC_${part1}_${part2}_${part3}`;
};

export async function GET(request: NextRequest) {
  try {
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
        WHERE btb.batch_uuid = '${batchUuid}'
        ORDER BY btb.partition_sequence
      `) as any[];

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
        WHERE btb.batch_id = '${batchId}'
        ORDER BY btb.partition_sequence
      `) as any[];

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
        WHERE raw_record_uuid = '${rawRecordUuid}'
        GROUP BY batch_uuid
      `) as any[];

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
        ${SOURCE_TABLES.map((table) => `SELECT raw_record_uuid, docnomination, docvaluedate FROM "${table}"`).join(' UNION ALL ')}
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
    const body = await request.json();
    const { 
      bankAccountUuid, 
      rawRecordId1, 
      rawRecordId2, 
      rawRecordUuid,
      partitions 
    } = body;

    const formatBatchId = (uuid: string) => {
      const compact = uuid.replace(/-/g, '').toUpperCase();
      const part1 = compact.slice(0, 6);
      const part2 = compact.slice(6, 8);
      const part3 = compact.slice(8, 14);
      return `BTC_${part1}_${part2}_${part3}`;
    };

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

    // Generate batch UUID
    const batchUuid = await prisma.$queryRawUnsafe(`SELECT gen_random_uuid()::text as uuid`) as any[];
    const newBatchUuid = batchUuid[0].uuid;
    const batchId = formatBatchId(newBatchUuid);

    const partitionValues = partitions
      .map((partition: any, index: number) => {
        const safePartitionAmount = Math.abs(Number(partition.partitionAmount));
        const safeNominalAmount =
          partition.nominalAmount !== null && partition.nominalAmount !== undefined
            ? Math.abs(Number(partition.nominalAmount))
            : null;
        return `(
          '${bankAccountUuid}',
          '${rawRecordId1}',
          '${rawRecordId2}',
          '${rawRecordUuid}',
          '${batchId}',
          '${newBatchUuid}',
          ${safePartitionAmount},
          ${index + 1},
          ${partition.paymentUuid ? `'${partition.paymentUuid}'` : 'NULL'},
          ${partition.paymentId ? `'${partition.paymentId}'` : 'NULL'},
          ${partition.counteragentUuid ? `'${partition.counteragentUuid}'::uuid` : 'NULL'},
          ${partition.projectUuid ? `'${partition.projectUuid}'::uuid` : 'NULL'},
          ${partition.financialCodeUuid ? `'${partition.financialCodeUuid}'::uuid` : 'NULL'},
          ${partition.nominalCurrencyUuid ? `'${partition.nominalCurrencyUuid}'::uuid` : 'NULL'},
          ${safeNominalAmount ?? 'NULL'},
          ${partition.partitionNote ? `'${partition.partitionNote.replace(/'/g, "''")}'` : 'NULL'}
        )`;
      })
      .join(',\n');

    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
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
        ) VALUES
        ${partitionValues}
      `);

      await Promise.all(
        SOURCE_TABLES.map((table) =>
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
    const { searchParams } = new URL(request.url);
    const batchUuid = searchParams.get('batchUuid');
    const partitionUuid = searchParams.get('partitionUuid');
    const paymentId = searchParams.get('paymentId');
    const paymentUuid = searchParams.get('paymentUuid');
    const rawRecordUuid = searchParams.get('rawRecordUuid');

    if (batchUuid) {
      // Delete entire batch
      await prisma.$executeRawUnsafe(`
        DELETE FROM bank_transaction_batches 
        WHERE batch_uuid = '${batchUuid}'
      `);
      return NextResponse.json({ success: true });
    }
    
    if (partitionUuid) {
      // Delete single partition
      await prisma.$executeRawUnsafe(`
        DELETE FROM bank_transaction_batches 
        WHERE uuid = '${partitionUuid}'
      `);
      return NextResponse.json({ success: true });
    }

    if (paymentId) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE payment_id = ${paymentId}
      `;
      return NextResponse.json({ success: true });
    }

    if (paymentUuid) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE payment_uuid = ${paymentUuid}::uuid
      `;
      return NextResponse.json({ success: true });
    }

    if (rawRecordUuid) {
      await prisma.$executeRaw`
        DELETE FROM bank_transaction_batches
        WHERE raw_record_uuid::text = ${rawRecordUuid}::text
      `;
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
