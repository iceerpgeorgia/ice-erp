const XLSX = require('xlsx');
const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  console.log('=== CHECKING TEMPLATE STRUCTURE IN SUPABASE ===');
  console.log('');

  // Load the export file (which was created from the template)
  const exportFile = fs.readFileSync('d:/export-test.xlsx');
  const zip = new JSZip();
  await zip.loadAsync(exportFile);

  // Extract sheet2.xml (Placeholders)
  const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');

  if (!sheet2Xml) {
    console.log('❌ sheet2.xml NOT FOUND');
    return;
  }

  console.log('Placeholders sheet (sheet2.xml) structure:');
  console.log('');

  // Look for row elements
  const rowMatches = sheet2Xml.match(/<row[^>]*>/g);
  console.log('Number of rows in template: ' + (rowMatches ? rowMatches.length : 0));
  console.log('');

  // Look at first 20 rows
  const rowPattern = /<row[^>]*>[\s\S]*?<\/row>/g;
  const rows = sheet2Xml.match(rowPattern) || [];
  
  console.log('Row contents:');
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    // Extract cell content
    const cellMatches = row.match(/<c r="[^"]*"[^>]*>[\s\S]*?<\/c>/g) || [];
    console.log('Row ' + (i + 1) + ' has ' + cellMatches.length + ' cells');
    
    if (cellMatches.length > 0) {
      cellMatches.forEach(cell => {
        // Extract r attribute (cell reference like A1, B2)
        const rMatch = cell.match(/r="([^"]*)"/);
        const rValue = rMatch ? rMatch[1] : '?';
        // Extract value
        const vMatch = cell.match(/<v>([^<]*)<\/v>/);
        const isMatch = cell.match(/<is><t>([^<]*)<\/t><\/is>/);
        const value = vMatch ? vMatch[1] : (isMatch ? isMatch[1] : '(empty)');
        console.log('  ' + rValue + ': ' + value.substring(0, 40));
      });
    }
  }

  console.log('');
  console.log('Analysis: If column A cells are empty or missing, that is the root cause');
  console.log('The VLOOKUP formulas in Handover sheet look for labels in A column');
})();
