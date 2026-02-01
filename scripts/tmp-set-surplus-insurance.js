const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ids95 = [
  '01027025241','62001030230','61001080225','01024071279','01027089573','01019058668','01019005894',
  '01991027885','35001081763','61008003787','01030006570','01026015799','01001014120','01008045332',
  '01030020929','61001034433','01003013827','61004004589','01012000978','01030049942','01005041132',
  '33001059430','01009020788','35001110621','01006011583','01007013287','04001014731','01027080902',
  '35001126484','01023012258','61001062399','61002012718','62001004570','01030009562','62001033449',
  '01008063825','14001028688','01018002620','01001021886','01012025656','35001112643','01031006443',
  '59001100234','01024032465','35001127620','01005026741','01024085074','01011038686','18001058845',
  '35001059957','61004067189','01007013161','01024007906'
];

const special = {
  '01024067298': 130,
  '01024008557': 268,
};

const run = async () => {
  const allIds = [...ids95, ...Object.keys(special)];
  const inList = allIds.map((id) => `'${id}'`).join(',');
  const caseExpr = "CASE WHEN ca.identification_number = '01024067298' THEN 130 WHEN ca.identification_number = '01024008557' THEN 268 ELSE 95 END";
  const query = `
    UPDATE salary_accruals sa
    SET surplus_insurance = ${caseExpr},
        deducted_insurance = COALESCE(sa.deducted_insurance, 0) - (${caseExpr})
    FROM counteragents ca
    WHERE sa.counteragent_uuid = ca.counteragent_uuid
      AND sa.salary_month >= $1::date
      AND sa.salary_month < $2::date
      AND ca.identification_number IN (${inList})
  `;

  const updated = await prisma.$executeRawUnsafe(query, '2026-01-01', '2026-02-01');
  console.log('Updated salary_accruals rows:', updated);
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
