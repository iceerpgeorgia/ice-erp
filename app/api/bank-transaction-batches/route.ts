import { NextResponse, NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchUuid = searchParams.get('batchUuid');
    const rawRecordUuid = searchParams.get('rawRecordUuid');
    
    if (batchUuid) {
      // Get specific batch with all partitions
      const partitions = await prisma.$queryRawUnsafe(`
        SELECT 
          btb.id,
          btb.uuid,
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

      return NextResponse.json(partitions);
    }
    
    if (rawRecordUuid) {
      // Check if raw record already has batches
      const batches = await prisma.$queryRawUnsafe(`
        SELECT batch_uuid, COUNT(*) as partition_count, SUM(partition_amount) as total_amount
        FROM bank_transaction_batches
        WHERE raw_record_uuid = '${rawRecordUuid}'
        GROUP BY batch_uuid
      `) as any[];

      return NextResponse.json(batches);
    }
    
    // Get all batches summary
    const batches = await prisma.$queryRawUnsafe(`
      SELECT * FROM bank_transaction_batch_summary
      ORDER BY created_at DESC
      LIMIT 100
    `) as any[];

    return NextResponse.json(batches);
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

    // Validation
    if (!bankAccountUuid || !rawRecordId1 || !rawRecordId2 || !partitions || partitions.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate batch UUID
    const batchUuid = await prisma.$queryRawUnsafe(`SELECT gen_random_uuid()::text as uuid`) as any[];
    const newBatchUuid = batchUuid[0].uuid;

    // Insert partitions
    const insertPromises = partitions.map((partition: any, index: number) => {
      return prisma.$queryRawUnsafe(`
        INSERT INTO bank_transaction_batches (
          bank_account_uuid,
          raw_record_id_1,
          raw_record_id_2,
          raw_record_uuid,
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
          '${bankAccountUuid}',
          '${rawRecordId1}',
          '${rawRecordId2}',
          '${rawRecordUuid}',
          '${newBatchUuid}',
          ${partition.partitionAmount},
          ${index + 1},
          ${partition.paymentUuid ? `'${partition.paymentUuid}'` : 'NULL'},
          ${partition.paymentId ? `'${partition.paymentId}'` : 'NULL'},
          ${partition.counteragentUuid ? `'${partition.counteragentUuid}'::uuid` : 'NULL'},
          ${partition.projectUuid ? `'${partition.projectUuid}'::uuid` : 'NULL'},
          ${partition.financialCodeUuid ? `'${partition.financialCodeUuid}'::uuid` : 'NULL'},
          ${partition.nominalCurrencyUuid ? `'${partition.nominalCurrencyUuid}'::uuid` : 'NULL'},
          ${partition.nominalAmount || 'NULL'},
          ${partition.partitionNote ? `'${partition.partitionNote.replace(/'/g, "''")}'` : 'NULL'}
        )
      `);
    });

    await Promise.all(insertPromises);

    return NextResponse.json({ 
      success: true, 
      batchUuid: newBatchUuid 
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

    return NextResponse.json(
      { error: 'Missing batchUuid or partitionUuid' },
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
