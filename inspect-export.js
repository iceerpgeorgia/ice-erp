const JSZip = require('jszip');
const fs = require('fs');

async function inspectExport() {
  const files = fs.readdirSync('.').filter(f => f.startsWith('export-test'));
  if (!files.length) {
    console.error('No export test files found');
    process.exit(1);
  }

  const latestFile = files.sort().pop();
  console.log('Inspecting:', latestFile);

  const buffer = fs.readFileSync(latestFile);
  const zip = new JSZip();
  await zip.loadAsync(buffer);

  const sheet2 = await zip.file('xl/worksheets/sheet2.xml')?.async('string');
  if (!sheet2) {
    console.error('sheet2.xml not found');
    process.exit(1);
  }

  console.log('\n=== CHECKING FOR POPULATED CELLS B1-B19 ===\n');
  
  for (let i = 1; i <= 19; i++) {
    const cellRef = `B${i}`;
    const cellPattern = new RegExp(`<c r="${cellRef}"[^>]*>([^<]*)<v>([^<]*)</v>[^<]*</c>`);
    const match = sheet2.match(cellPattern);
    
    if (match) {
      const value = match[2] || '(empty)';
      console.log(`✓ ${cellRef}: ${value.substring(0, 50)}`);
    } else {
      console.log(`✗ ${cellRef}: NOT FOUND`);
    }
  }

  // Show first 3000 chars of sheet2
  console.log('\n=== FIRST 3000 CHARS OF SHEET2.XML ===');
  console.log(sheet2.substring(0, 3000));
}

inspectExport().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
