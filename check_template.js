const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  const buffer = fs.readFileSync('public/handover template.xlsx');
  const zip = new JSZip();
  await zip.loadAsync(buffer);
  
  const sheet2 = await zip.file('xl/worksheets/sheet2.xml')?.async('string');
  console.log('=== SHEET2.XML LENGTH ===');
  console.log(sheet2.length);
  
  console.log('\n=== SHEET2.XML FIRST 2000 CHARS ===');
  console.log(sheet2.substring(0, 2000));
  
  console.log('\n=== LOOKING FOR B1-B19 CELLS ===');
  for (let i = 1; i <= 19; i++) {
    const cellRef = `B${i}`;
    const pattern = new RegExp(`<c r="${cellRef}"[^>]*>[\\s\\S]*?<\\/c>`, 'g');
    const match = sheet2.match(pattern);
    if (match) {
      console.log(`${cellRef}: Found - ${match[0].substring(0, 100)}...`);
    } else {
      console.log(`${cellRef}: NOT FOUND`);
    }
  }
})();
