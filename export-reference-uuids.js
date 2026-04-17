// Export UUIDs for migration Excel file
// This helps you get the UUIDs needed for your migration template

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');

const prisma = new PrismaClient();

async function exportUUIDs() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Export UUIDs for Migration                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  
  // Fetch all data
  const [projects, documentTypes, currencies] = await Promise.all([
    prisma.projects.findMany({
      select: { 
        project_uuid: true,
        project_name: true,
        counteragent: true,
        contract_no: true,
        date: true
      },
      orderBy: { project_name: 'asc' }
    }),
    prisma.document_types.findMany({
      where: { is_active: true },
      select: { uuid: true, name: true },
      orderBy: { name: 'asc' }
    }),
    prisma.currencies.findMany({
      where: { is_active: true },
      select: { uuid: true, code: true, name: true },
      orderBy: { code: 'asc' }
    })
  ]);
  
  console.log(`Found ${projects.length} projects, ${documentTypes.length} document types, ${currencies.length} currencies`);
  console.log('');
  
  // Create Excel workbook
  const wb = XLSX.utils.book_new();
  
  // Projects sheet
  const projectsData = projects.map(p => ({
    project_uuid: p.project_uuid,
    project_name: p.project_name,
    counteragent: p.counteragent,
    contract_no: p.contract_no,
    date: p.date
  }));
  const projectsWs = XLSX.utils.json_to_sheet(projectsData);
  projectsWs['!cols'] = [
    { wch: 40 },  // project_uuid
    { wch: 40 },  // project_name
    { wch: 30 },  // counteragent
    { wch: 20 },  // contract_no
    { wch: 12 }   // date
  ];
  XLSX.utils.book_append_sheet(wb, projectsWs, 'Projects');
  
  // Document types sheet
  const docTypesData = documentTypes.map(dt => ({
    uuid: dt.uuid,
    name: dt.name
  }));
  const docTypesWs = XLSX.utils.json_to_sheet(docTypesData);
  docTypesWs['!cols'] = [
    { wch: 40 },  // uuid
    { wch: 20 }   // name
  ];
  XLSX.utils.book_append_sheet(wb, docTypesWs, 'Document Types');
  
  // Currencies sheet
  const currenciesData = currencies.map(c => ({
    uuid: c.uuid,
    code: c.code,
    name: c.name
  }));
  const currenciesWs = XLSX.utils.json_to_sheet(currenciesData);
  currenciesWs['!cols'] = [
    { wch: 40 },  // uuid
    { wch: 10 },  // code
    { wch: 20 }   // name
  ];
  XLSX.utils.book_append_sheet(wb, currenciesWs, 'Currencies');
  
  // Write file
  const filename = 'reference-uuids.xlsx';
  XLSX.writeFile(wb, filename);
  
  console.log(`✅ Created: ${filename}`);
  console.log('');
  console.log('This file contains 3 sheets:');
  console.log(`  • Projects (${projects.length} rows) - Use project_uuid column for project_uuid`);
  console.log(`  • Document Types (${documentTypes.length} rows) - Use uuid column for document_type_uuid`);
  console.log(`  • Currencies (${currencies.length} rows) - Use uuid column for currency_uuid`);
  console.log('');
  console.log('How to use:');
  console.log('  1. Open reference-uuids.xlsx');
  console.log('  2. Find your project/document type/currency by name');
  console.log('  3. Copy the UUID from the uuid (or project_uuid) column');
  console.log('  4. Paste into your migration Excel file');
  console.log('');
  console.log('Example:');
  console.log('  If Projects sheet shows:');
  console.log('    project_uuid: 12345678-1234-5678-1234-567812345678');
  console.log('    project_name: Vake Mall Project');
  console.log('');  
  console.log('  Then in your migration Excel, use:');
  console.log('    project_uuid: 12345678-1234-5678-1234-567812345678');
  
  // Also print to console for quick reference
  console.log('');
  console.log('═══ DOCUMENT TYPES ═══');
  documentTypes.forEach(dt => {
    console.log(`  ${dt.name.padEnd(15)} → ${dt.uuid}`);
  });
  
  console.log('');
  console.log('═══ CURRENCIES ═══');
  currencies.forEach(c => {
    console.log(`  ${c.code.padEnd(5)} ${c.name.padEnd(20)} → ${c.uuid}`);
  });
  
  if (projects.length <= 20) {
    console.log('');
    console.log('═══ PROJECTS ═══');
    projects.forEach(p => {
      const displayName = p.project_name || 'Unnamed';
      const displayContract = p.contract_no || 'No contract';
      console.log(`  ${displayContract.padEnd(20)} ${displayName.padEnd(30)} → ${p.project_uuid}`);
    });
  } else {
    console.log('');
    console.log(`═══ PROJECTS (${projects.length} total - see Excel file) ═══`);
    console.log('  Too many projects to display. Check reference-uuids.xlsx for full list.');
  }
}

async function main() {
  try {
    await exportUUIDs();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
