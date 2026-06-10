const JSZip = require('jszip');
const fs = require('fs');

const xlsx = fs.readFileSync('./public/handover template.xlsx');

JSZip.loadAsync(xlsx).then(zip => {
  const workbookXml = zip.file('xl/workbook.xml');
  if (workbookXml) {
    return workbookXml.async('string').then(xml => {
      console.log('=== Sheets in template ===\n');
      const sheetMatches = xml.match(/<sheet[^>]*name="([^"]+)"[^>]*>/g);
      if (sheetMatches) {
        sheetMatches.forEach((match, i) => {
          const nameMatch = match.match(/name="([^"]+)"/);
          if (nameMatch) {
            console.log(`${i + 1}. ${nameMatch[1]}`);
          }
        });
      } else {
        console.log('No sheets found');
      }
      
      // Also check what files are in the worksheets directory
      console.log('\n=== Files in xl/worksheets/ ===\n');
      let count = 0;
      zip.folder('xl/worksheets').forEach((relativePath, file) => {
        if (!file.dir && relativePath.endsWith('.xml')) {
          console.log(relativePath);
          count++;
        }
      });
      if (count === 0) {
        console.log('No worksheet files found');
      }
    });
  }
}).catch(err => console.error('Error:', err.message));
