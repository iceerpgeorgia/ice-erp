const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const missingRsIds = ['658299815','686995278','690075930','703657779','705429418','709628638','753677464','809813913','810755990','827087233','850845148','899938850','902771907','902772452','985243762','986803615'];

const allWaybillNos = ['0966261191','0946645721','0945097554','0933986080','0932015226','0887716728','0882763280','0871223449','0869304453','0863155627','0863155083','0860384031','0842129590','0840031585','0827663505','0812109702','0800576391','0798399979','0789142546','0782336821','0778520188','0773329299','0772402169','0762088424','0755530881','0748467761','0741876921','0728711838','0723690933','0721763503','0719415233','0718076065','0710617236','0706742240','0706055737','0702388190','0701842598','0701628465','0700403555','0694097710','0693609573','0692177048','0675388881','0671345125','0669638771','0658866875','0658635331','0658447341','0656588340','0653652852','0649745743','0635070901','0631354848','0626162613','0561680993','0554577657','0542175764','0541075033','0531604941','0530332309','0529838662','0529438874','0528487076','0526733393','0523322013','0506193188','0504680516','0501844880'];

async function main() {
  // Get details of missing waybills
  const missingWaybills = await prisma.rs_waybills_in_api.findMany({
    where: { rs_id: { in: missingRsIds } },
    select: { rs_id: true, waybill_no: true, create_date: true, activation_time: true, insider_uuid: true }
  });
  missingWaybills.sort((a, b) => new Date(a.create_date || 0) - new Date(b.create_date || 0));
  console.log('=== Missing waybills details ===');
  missingWaybills.forEach(r => {
    const cd = r.create_date ? r.create_date.toISOString().slice(0, 7) : 'null';
    console.log(`  rs_id=${r.rs_id}  waybill_no=${r.waybill_no}  create_date=${cd}  insider=${r.insider_uuid ? r.insider_uuid.slice(0, 8) : 'null'}`);
  });

  // Distinct insiders across all 68
  const allRows = await prisma.rs_waybills_in_api.findMany({
    where: { waybill_no: { in: allWaybillNos } },
    select: { insider_uuid: true },
    distinct: ['insider_uuid']
  });
  console.log('\n=== Distinct insiders across all 68 waybills ===');
  allRows.forEach(r => console.log(' ', r.insider_uuid));

  // Date range of missing
  const dates = missingWaybills.map(r => r.create_date).filter(Boolean);
  if (dates.length) {
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    console.log(`\n=== Missing waybills date range: ${min.toISOString().slice(0, 7)} to ${max.toISOString().slice(0, 7)} ===`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
