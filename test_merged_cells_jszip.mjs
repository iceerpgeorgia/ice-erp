import JSZip from 'jszip';
import { readFileSync, writeFileSync } from 'fs';

async function testMergedCellsPreservation() {
  console.log('=== Testing Merged Cells Preservation Through JSZip ===\n');

  // Load the template
  const templatePath = 'public/Handover Tamplate New.xlsx';
  const templateBuffer = readFileSync(templatePath);
  console.log('1. Template loaded, size:', templateBuffer.length, 'bytes');

  // Load into JSZip
  const originalZip = new JSZip();
  await originalZip.loadAsync(templateBuffer);
  console.log('2. Template loaded into JSZip');

  // Read sheet1.xml
  const sheet1Original = await originalZip.file('xl/worksheets/sheet1.xml')?.async('string');
  console.log('3. sheet1.xml read from ZIP, size:', sheet1Original?.length, 'bytes');

  // Check for merged cells in original
  const mergeCellsMatches = sheet1Original?.match(/<mergedCell[^>]*>/g);
  const mergeCellsCount = mergeCellsMatches?.length || 0;
  console.log('4. Merged cells found in original:', mergeCellsCount);
  if (mergeCellsCount > 0) {
    console.log('   First 3 merged cells:');
    mergeCellsMatches?.slice(0, 3).forEach((cell, i) => {
      console.log(`   ${i + 1}. ${cell}`);
    });
  }

  // Check if mergeCells element exists
  const hasMergeCellsElement = sheet1Original?.includes('<mergeCells>');
  console.log('5. Has <mergeCells> element:', hasMergeCellsElement);

  // Now generate output without modifying anything
  console.log('\n6. Generating output without any modifications...');
  const outputBuffer = await originalZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  console.log('7. Output generated, size:', outputBuffer.length, 'bytes');

  // Load output and check merged cells
  const outputZip = new JSZip();
  await outputZip.loadAsync(outputBuffer);
  
  const sheet1Output = await outputZip.file('xl/worksheets/sheet1.xml')?.async('string');
  console.log('8. sheet1.xml read from OUTPUT, size:', sheet1Output?.length, 'bytes');

  const outputMergeCells = sheet1Output?.match(/<mergedCell[^>]*>/g);
  const outputMergeCellsCount = outputMergeCells?.length || 0;
  console.log('9. Merged cells found in OUTPUT:', outputMergeCellsCount);
  if (outputMergeCellsCount > 0) {
    console.log('   First 3 merged cells in output:');
    outputMergeCells?.slice(0, 3).forEach((cell, i) => {
      console.log(`   ${i + 1}. ${cell}`);
    });
  }

  // Compare
  console.log('\n=== RESULTS ===');
  console.log('Original merged cells:', mergeCellsCount);
  console.log('Output merged cells:', outputMergeCellsCount);
  console.log('Merged cells preserved:', mergeCellsCount === outputMergeCellsCount ? '✓ YES' : '✗ NO');

  // Check XML sizes
  console.log('\nXML sizes:');
  console.log('Original sheet1.xml:', sheet1Original?.length, 'bytes');
  console.log('Output sheet1.xml:', sheet1Output?.length, 'bytes');
  console.log('Size difference:', (sheet1Output?.length || 0) - (sheet1Original?.length || 0), 'bytes');

  // Check if mergeCells element exists in output
  const outputHasMergeCells = sheet1Output?.includes('<mergeCells>');
  console.log('\nHas <mergeCells> element in output:', outputHasMergeCells);
}

testMergedCellsPreservation().catch(console.error);
