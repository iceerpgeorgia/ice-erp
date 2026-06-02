// Finish step 6: delete ledger id=96 (old duplicate for 1.1.1.2) then delete the non-bundle payment
const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
const J=(v)=>JSON.stringify(v,(k,v)=>typeof v==='bigint'?Number(v):v,2);

async function main() {
  // Step 6a: delete old duplicate ledger entry (bundle already has ledger 18535 for same amount)
  const del_ledger = await p.$queryRawUnsafe(`
    DELETE FROM payments_ledger WHERE id = 96
    RETURNING id, payment_id, "order", comment
  `);
  console.log('Deleted ledger id=96:\n' + J(del_ledger));

  // Step 6b: now delete the non-bundle payment (no ledger entries remain)
  const del_pay = await p.$queryRawUnsafe(`
    DELETE FROM payments WHERE payment_id = 'b94197_21_95579c'
    RETURNING id, payment_id
  `);
  console.log('Deleted non-bundle payment b94197_21_95579c:\n' + J(del_pay));

  // Verify
  const remaining = await p.$queryRawUnsafe(`
    SELECT p.id, p.payment_id, fc.code AS fc, p.is_bundle_payment,
      (SELECT COUNT(*)::int FROM payments_ledger pl WHERE pl.payment_id=p.payment_id AND pl.is_deleted=false) ledger_count
    FROM payments p LEFT JOIN financial_codes fc ON fc.uuid=p.financial_code_uuid
    WHERE p.payment_id IN ('b9588e_96_cce31f','8d9db8_5d_e91914','67149c_44_8d4f7d','b94197_21_95579c')
    ORDER BY p.id
  `);
  console.log('\nRemaining payments:\n' + J(remaining));
}

main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>p.$disconnect());
