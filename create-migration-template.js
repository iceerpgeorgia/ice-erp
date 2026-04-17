// Excel Template Generator for Google Drive Migration
// Run this to create a sample Excel file with the correct structure

const XLSX = require('xlsx');

// Create sample data
const sampleData = [
  {
    file_name: 'Vake_Mall_Contract.pdf',
    gdrive_url: 'https://drive.google.com/file/d/1ABC123XYZ456/view?usp=sharing',
    project_uuid: '12345678-1234-5678-1234-567812345678',
    document_type_uuid: 'ad073cad-2b77-437b-aa2d-c61d9042d583', // Contract
    document_date: '2025-09-01',
    document_no: 'CONTRACT-2025-001',
    document_value: 6011672.50,
    currency_uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' // USD
  },
  {
    file_name: 'Saburtalo_Invoice.pdf',
    gdrive_url: 'https://drive.google.com/file/d/2DEF456ABC789/view',
    project_uuid: '87654321-4321-8765-4321-876543218765',
    document_type_uuid: 'ef60f280-59ce-4c19-b7f8-9e7e7f597142', // Invoice
    document_date: '2025-10-15',
    document_no: 'INV-2025-045',
    document_value: 125000.00,
    currency_uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' // GEL
  },
  {
    file_name: 'Didi_Dighomi_Agreement.pdf',
    gdrive_url: 'https://drive.google.com/open?id=3GHI789JKL012',
    project_uuid: 'abcdef12-3456-7890-abcd-ef1234567890',
    document_type_uuid: '5eee6b9e-97b2-4a78-b442-355af1e9920c', // Agreement
    document_date: '2025-08-20',
    document_no: '',
    document_value: null,
    currency_uuid: ''
  }
];

// Create workbook
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(sampleData);

// Set column widths
ws['!cols'] = [
  { wch: 35 },  // file_name
  { wch: 60 },  // gdrive_url
  { wch: 40 },  // project_uuid
  { wch: 40 },  // document_type_uuid
  { wch: 15 },  // document_date
  { wch: 20 },  // document_no
  { wch: 15 },  // document_value
  { wch: 40 }   // currency_uuid
];

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Attachments');

// Write to file
XLSX.writeFile(wb, 'attachment-migration-template.xlsx');

console.log('✅ Created: attachment-migration-template.xlsx');
console.log('');
console.log('Template includes 3 sample rows with UUIDs. Replace with your actual data.');
console.log('');
console.log('⚠️  IMPORTANT: Replace sample UUIDs with your actual UUIDs from database!');
console.log('');
console.log('Required columns:');
console.log('  • file_name (required)');
console.log('  • gdrive_url (required)');
console.log('');
console.log('Recommended columns (use UUIDs for direct binding):');
console.log('  • project_uuid (project UUID from projects table)');
console.log('  • document_type_uuid (document type UUID from document_types table)');
console.log('  • currency_uuid (currency UUID from currencies table)');
console.log('  • document_date (date on the document)');
console.log('  • document_no (document reference number)');
console.log('  • document_value (monetary amount)');
console.log('');
console.log('To get your project UUIDs, run:');
console.log('  SELECT project_name, project_number, uuid FROM projects;');