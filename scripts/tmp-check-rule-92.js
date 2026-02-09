const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ruleId = 92;
const recordId = 38358;

const normalize = (value) => (value === null || value === undefined ? '' : String(value).trim());

const main = async () => {
  const rule = await prisma.$queryRawUnsafe(
    'SELECT id, column_name, condition, condition_script FROM parsing_scheme_rules WHERE id=$1',
    ruleId
  );
  console.log('Rule', rule[0]);

  const record = await prisma.$queryRawUnsafe(
    `SELECT id, uuid, DocProdGroup, DocNomination, DocInformation, DocKey, DocComment,
            DocSenderInn, DocBenefInn, DocSenderName, DocBenefName, EntryDbAmt, EntryCrAmt
     FROM bog_gel_raw_893486000 WHERE id=$1`,
    recordId
  );
  console.log('Record', record[0]);

  if (!rule[0] || !record[0]) return;

  const rowMap = {
    dockey: record[0].dockey ?? record[0].DocKey,
    docprodgroup: record[0].docprodgroup ?? record[0].DocProdGroup,
    docnomination: record[0].docnomination ?? record[0].DocNomination,
    docinformation: record[0].docinformation ?? record[0].DocInformation,
  };
  console.log('RowMap', rowMap);

  if (rule[0].condition_script) {
    const fn = eval(rule[0].condition_script);
    console.log('ScriptResult', fn(rowMap));
  } else if (rule[0].column_name && rule[0].condition) {
    const field = rowMap[String(rule[0].column_name || '').toLowerCase()];
    console.log('DirectMatch', normalize(field) === normalize(rule[0].condition), 'field', field);
  } else {
    console.log('Rule has no condition or script to evaluate');
  }
};

main()
  .catch((error) => {
    console.error('Check failed:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
