const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.rs_waybills_in_items.findMany({
  where:{unit:'ბ'},
  take:6,
  select:{goods_name:true,unit:true,quantity:true,unit_price:true,seller_name:true,create_date:true}
})
.then(r=>{
  r.forEach(x=>console.log(`${x.create_date?.toISOString().slice(0,10)} | ${x.goods_name} | qty:${x.quantity} | price:${x.unit_price} | ${x.seller_name}`));
  return p.$disconnect();
})
.catch(e=>{console.error(e.message);process.exit(1);});
