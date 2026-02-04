const { Pool } = require('pg');

const TABLES = [
  'GE78BG0000000893486000_BOG_GEL',
  'GE65TB7856036050100002_TBC_GEL',
];

const extractPaymentID = (docInformation) => {
  if (!docInformation) return null;
  const text = String(docInformation).trim();

  let match = text.match(/payment[_\s]*id[:\s]*(\w+)/i);
  if (match) return match[1];

  match = text.match(/^id[:\s]+(\w+)/i);
  if (match) return match[1];

  match = text.match(/[#№](\w+)/);
  if (match) return match[1];

  match = text.match(/NP_[A-Fa-f0-9]{6}_NJ_[A-Fa-f0-9]{6}_PRL\d{6}/);
  if (match) return match[0];

  if (/^[A-Z0-9-_]+$/i.test(text) && text.length >= 5 && text.length <= 50) {
    return text;
  }

  return null;
};

const normalizeId = (value) => (value == null ? '' : String(value).trim());
const normalizeCompare = (value) => normalizeId(value).toLowerCase();

async function columnExists(client, tableName, columnName) {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = $1 AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return result.rows.length > 0;
}

async function loadTextColumns(client, tableName) {
  const candidates = [
    'docinformation',
    'doc_information',
    'additional_information',
    'description',
    'docnomination',
  ];
  const available = [];
  for (const column of candidates) {
    if (await columnExists(client, tableName, column)) {
      available.push(column);
    }
  }
  return available;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    for (const tableName of TABLES) {
      console.log(`\n🔎 Checking ${tableName}...`);
      const textColumns = await loadTextColumns(client, tableName);
      if (textColumns.length === 0) {
        console.log('  ⚠️  No text columns available to extract payment ID. Skipping.');
        continue;
      }

      console.log(`  Using raw text columns: ${textColumns.join(', ')}`);

      let lastId = 0n;
      let updatedCount = 0;
      let scannedCount = 0;

      while (true) {
        const query = `
          SELECT id, payment_id, parsing_lock, ${textColumns.map((c) => `"${c}"`).join(', ')}
          FROM "${tableName}"
          WHERE id > $1
            AND payment_id IS NOT NULL
            AND parsing_lock = false
          ORDER BY id ASC
          LIMIT 1000
        `;
        const result = await client.query(query, [lastId.toString()]);
        if (result.rows.length === 0) break;

        const idsToUpdate = [];

        for (const row of result.rows) {
          scannedCount += 1;
          lastId = BigInt(row.id);

          const rawText = textColumns.map((col) => row[col]).find((val) => val != null && String(val).trim() !== '');
          if (!rawText) continue;

          const extracted = extractPaymentID(rawText);
          if (!extracted) continue;

          const currentPaymentId = normalizeId(row.payment_id);

          if (normalizeCompare(extracted) !== normalizeCompare(currentPaymentId)) {
            idsToUpdate.push(row.id);
          }
        }

        if (idsToUpdate.length > 0) {
          await client.query(
            `UPDATE "${tableName}" SET parsing_lock = true WHERE id = ANY($1::bigint[])`,
            [idsToUpdate]
          );
          updatedCount += idsToUpdate.length;
        }
      }

      console.log(`  ✅ Scanned: ${scannedCount} rows`);
      console.log(`  ✅ Updated parsing_lock: ${updatedCount} rows`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('❌ Failed to update parsing_lock:', error);
  process.exit(1);
});
