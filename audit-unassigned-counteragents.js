/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // 1. Get all active deconsolidated tables
    const accounts = await prisma.$queryRawUnsafe(
      `SELECT raw_table_name FROM bank_accounts WHERE raw_table_name IS NOT NULL AND raw_table_name <> '' AND is_active = true ORDER BY id`
    );
    const tables = accounts.map((r) => r.raw_table_name);
    console.log(`Active deconsolidated tables: ${tables.length}`);
    tables.forEach((t) => console.log(`  - ${t}`));
    if (tables.length === 0) return;

    // 2. Inspect column set of the first table (assume all share schema)
    const sample = tables[0];
    const cols = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      sample
    );
    const colNames = cols.map((c) => c.column_name);
    const hasInn = colNames.includes('counteragent_inn');
    const hasUuid = colNames.includes('counteragent_uuid');
    const hasProcessed = colNames.includes('counteragent_processed');
    console.log(`\nSchema of ${sample}: counteragent_inn=${hasInn} counteragent_uuid=${hasUuid} counteragent_processed=${hasProcessed}`);

    if (!hasInn || !hasUuid) {
      console.log('Missing required columns; aborting audit.');
      return;
    }

    // 3. Audit each table for unassigned but identifiable rows
    let grandTotal = 0;
    const perCounteragent = new Map();
    for (const table of tables) {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT
           t.id::text AS id,
           t.counteragent_inn,
           t.transaction_date,
           c.counteragent_uuid AS matched_uuid,
           COALESCE(c.insider_name, c.counteragent, c.name) AS matched_name
         FROM "${table}" t
         JOIN counteragents c
           ON c.identification_number = t.counteragent_inn
          AND c.is_active = true
         WHERE t.counteragent_uuid IS NULL
           AND t.counteragent_inn IS NOT NULL
           AND t.counteragent_inn <> ''`
      );
      console.log(`\nTable ${table}: ${rows.length} unassigned-but-identifiable row(s)`);
      grandTotal += rows.length;
      for (const r of rows) {
        const key = `${r.matched_uuid}|${r.matched_name}|${r.counteragent_inn}`;
        perCounteragent.set(key, (perCounteragent.get(key) ?? 0) + 1);
      }
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total unassigned-but-identifiable rows: ${grandTotal}`);
    console.log(`Distinct counteragents that could be auto-linked: ${perCounteragent.size}`);
    if (perCounteragent.size > 0) {
      const sorted = Array.from(perCounteragent.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50);
      console.log(`\nTop matches (counteragent | INN | row count):`);
      for (const [key, count] of sorted) {
        const [uuid, name, inn] = key.split('|');
        console.log(`  ${count.toString().padStart(5)}  ${name}  [INN ${inn}]  ${uuid}`);
      }
    }
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.code) console.error('  code:', err.code);
  } finally {
    await prisma.$disconnect();
  }
})();
