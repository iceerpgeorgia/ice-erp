const JSZip = require('jszip');
const fs = require('fs');

(async () => {
  console.log('=== PROJECT 975f3203-d3ec-4f9c-a396-1a68ae4b7e30 EXPORT ANALYSIS ===');
  console.log('');

  const filePath = 'd:/export-test-2.xlsx';
  const fileBuffer = fs.readFileSync(filePath);
  const zip = new JSZip();
  await zip.loadAsync(fileBuffer);

  const sheet2Xml = await zip.file('xl/worksheets/sheet2.xml')?.async('string');

  if (!sheet2Xml) {
    console.log('❌ sheet2.xml NOT FOUND');
    return;
  }

  console.log('Placeholders Sheet data for project 975f3203-d3ec-4f9c-a396-1a68ae4b7e30:');
  console.log('');

  // Extract all rows with data
  const rowPattern = /<row r="(\d+)"[\s\S]*?<\/row>/g;
  let match;
  
  while ((match = rowPattern.exec(sheet2Xml)) !== null) {
    const rowNum = parseInt(match[1]);
    if (rowNum > 19) continue;
    
    const rowContent = match[0];
    
    // Extract cells
    const cellPattern = /<c r="([A-Z]+\d+)"[\s\S]*?<\/c>/g;
    let cellMatch;
    
    while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
      const cellRef = cellMatch[1];
      const fullCell = cellMatch[0];
      
      const vMatch = fullCell.match(/<v>([^<]*)<\/v>/);
      const isMatch = fullCell.match(/<is><t>([^<]*)<\/t><\/is>/);
      const value = vMatch ? vMatch[1] : (isMatch ? isMatch[1] : '(empty)');
      
      console.log(cellRef + ': ' + (value === '' ? '(EMPTY STRING)' : value).substring(0, 60));
    }
  }
})();
