#!/usr/bin/env node
/**
 * Delete all accruals and orders for payment_ID: 668ca4_15_a1fb37
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function deletePaymentLedgerRecords() {
  const paymentId = '668ca4_15_a1fb37';

  console.log(`[START] Deleting all ledger entries for payment_ID: ${paymentId}`);

  try {
    // First, fetch all records to be deleted for logging
    const recordsToDelete = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, payment_id, effective_date, accrual, "order", comment 
       FROM payments_ledger 
       WHERE payment_id = $1
       ORDER BY effective_date DESC`,
      paymentId
    );

    console.log(`[FOUND] ${recordsToDelete.length} ledger entries to delete`);

    if (recordsToDelete.length === 0) {
      console.log('[WARN] No entries found for this payment ID');
      return { success: true, deleted: 0, records: [] };
    }

    // Log them for reference
    console.log('\n[RECORDS TO DELETE]:');
    recordsToDelete.forEach((r, i) => {
      console.log(`  ${i + 1}. ID: ${r.id} | Date: ${r.effective_date} | Accrual: ${r.accrual} | Order: ${r.order}`);
    });

    // Delete all ledger entries for this payment
    const result = await prisma.payments_ledger.deleteMany({
      where: {
        payment_id: paymentId
      }
    });

    console.log(`\n[SUCCESS] Deleted ${result.count} ledger entries`);

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      paymentId,
      action: 'DELETE',
      deleted_count: result.count,
      deleted_records: recordsToDelete.map(r => ({
        id: Number(r.id),
        effective_date: r.effective_date,
        accrual: r.accrual ? Number(r.accrual) : null,
        order: r.order ? Number(r.order) : null,
        comment: r.comment
      }))
    };

    // Save report
    const reportPath = `delete_ledger_report_${paymentId}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n[REPORT] Saved to: ${reportPath}`);

    return { success: true, deleted: result.count, records: recordsToDelete };
  } catch (error: any) {
    console.error('[ERROR] Failed to delete records:', error.message);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

deletePaymentLedgerRecords().then(result => {
  process.exit(result.success ? 0 : 1);
});
