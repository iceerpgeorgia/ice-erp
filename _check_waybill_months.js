require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
  SELECT 
    to_char(create_date AT TIME ZONE 'Asia/Tbilisi', 'YYYY-MM') as ym,
    COUNT(*) as cnt
  FROM rs_waybills_in_api
  GROUP BY ym
  ORDER BY ym
`;

c.connect()
  .then(() => c.query(sql))
  .then(r => {
    // Build a set of months that exist in DB
    const dbMonths = new Map(r.rows.map(x => [x.ym, parseInt(x.cnt)]));

    // Build expected months 2020-01 to 2026-05
    const expected = [];
    let y = 2020, m = 1;
    while (y < 2026 || (y === 2026 && m <= 5)) {
      expected.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }

    console.log('\n=== Per-month record counts ===');
    for (const ym of expected) {
      const cnt = dbMonths.get(ym) ?? 0;
      console.log(`${ym}: ${cnt}${cnt === 0 ? '  ← ZERO' : ''}`);
    }

    const missing = expected.filter(ym => !dbMonths.has(ym));
    console.log(`\n=== Months with 0 records in DB ===`);
    if (missing.length === 0) console.log('None — all months have at least 1 record');
    else missing.forEach(m => console.log(m));

    console.log(`\nTotal rows: ${r.rows.reduce((s, x) => s + parseInt(x.cnt), 0)}`);
    c.end();
  })
  .catch(e => { console.error(e); c.end(); });
