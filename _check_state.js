const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();
Promise.all([
  p.$queryRawUnsafe("SELECT id, payment_id FROM payments_ledger WHERE id IN (207, 96)"),
  p.$queryRawUnsafe('SELECT id, payment_id FROM "GE78BG0000000893486000_BOG_GEL" WHERE id IN (28715,30514,31584)'),
  p.$queryRawUnsafe("SELECT id, payment_id, payment_uuid FROM bank_transaction_batches WHERE id=423"),
  p.$queryRawUnsafe("SELECT id, payment_id FROM payments WHERE payment_id IN ('67149c_44_8d4f7d','b94197_21_95579c')"),
]).then(([ledger,raw,batch,pay])=>{
  const J=(v)=>JSON.stringify(v,(k,v)=>typeof v==='bigint'?Number(v):v,2);
  console.log('Ledger state:', J(ledger));
  console.log('Raw rows:', J(raw));
  console.log('Batch 423:', J(batch));
  console.log('Non-bundle payments remaining:', J(pay));
}).finally(()=>p.$disconnect());
