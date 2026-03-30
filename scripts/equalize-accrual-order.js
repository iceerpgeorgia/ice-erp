const { PrismaClient } = require('../node_modules/@prisma/client');
const p = new PrismaClient();

const paymentIds = [
  '992ada_e7_b570b6','8fca2f_0a_8e8902','88091a_c2_8f2cab','7d310b_4c_9d783f',
  '7d159e_8b_8f1b61','7bded9_dd_8e512d','7085bc_cf_96b78e','5e402b_92_85a0b6',
  '5111e5_af_ab0b7b','43858b_bc_b445a4','401292_29_a356f4','3e77e2_65_a2d449',
  '39d29f_49_a91f48','2aa0c2_7d_994e34','211df7_8a_a1b663','211524_bf_93ea1f',
  '126c79_fd_9bcf96','0e6141_57_b349cd','074a77_67_b115de','059a8f_72_9bc5d4'
];

(async () => {
  // Show current state
  console.log('=== BEFORE ===');
  for (const pid of paymentIds) {
    const rows = await p.$queryRawUnsafe(
      `SELECT id, payment_id, accrual, "order", is_deleted FROM payments_ledger WHERE payment_id = $1 AND is_deleted = false`, pid
    );
    if (rows.length !== 1) { console.log(`${pid}: WARNING ${rows.length} rows!`); continue; }
    const r = rows[0];
    console.log(`${pid}: accrual=${r.accrual} order=${r.order} ${r.accrual === r.order ? 'EQUAL' : 'DIFF'}`);
  }

  // Update: set accrual = order (all have accrual=0, order=350)
  const result = await p.$queryRawUnsafe(`
    UPDATE payments_ledger 
    SET accrual = "order", updated_at = NOW()
    WHERE payment_id = ANY($1::text[]) 
      AND is_deleted = false 
      AND accrual IS DISTINCT FROM "order"
    RETURNING payment_id, accrual, "order"
  `, paymentIds);

  console.log(`\n=== UPDATED ${result.length} rows ===`);
  for (const r of result) {
    console.log(`${r.payment_id}: accrual=${r.accrual} order=${r.order}`);
  }

  await p.$disconnect();
})();
