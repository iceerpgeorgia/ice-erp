// Script to fetch Figma table design and update React component
// Usage: node scripts/fetch-figma-table.js countries 4:3

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const FIGMA_TOKEN = process.env.FIGMA_TOKEN.replace(/'/g, '');
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;

const TABLE_NODE_ID = process.argv[3] || '4:3'; // e.g. '4:3' for countries
const TABLE_NAME = process.argv[2] || 'countries';
const OUT_FILE = path.resolve(__dirname, `../components/${TABLE_NAME}-table.tsx`);

async function fetchFigmaCode(fileKey, nodeId) {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`;
  const headers = { 'X-Figma-Token': FIGMA_TOKEN };
  const res = await axios.get(url, { headers });
  return res.data;
}

async function main() {
  try {
    console.log(`[figma] Fetching table design for node ${TABLE_NODE_ID} from file ${FIGMA_FILE_KEY}`);
    const data = await fetchFigmaCode(FIGMA_FILE_KEY, TABLE_NODE_ID);
    // For demo: just write the raw JSON to the component file
    fs.writeFileSync(OUT_FILE, `// Figma node data for ${TABLE_NAME}\nexport const figmaTableData = ${JSON.stringify(data, null, 2)};\n`);
    console.log(`[figma] Wrote Figma table data to ${OUT_FILE}`);
    // TODO: Parse Figma node and generate JSX/Tailwind code
  } catch (err) {
    console.error('[figma] Error:', err.message);
  }
}

main();
