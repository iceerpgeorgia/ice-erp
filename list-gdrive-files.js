/**
 * List Google Drive Files
 * 
 * This helper script lists all files that your service account can access
 * and exports them to Excel with file IDs, names, and metadata.
 * 
 * PREREQUISITES:
 * 1. Google credentials file saved as google-credentials.json
 * 2. Files/folders shared with service account email
 * 
 * USAGE:
 * node list-gdrive-files.js [folder-id]
 * 
 * Examples:
 * node list-gdrive-files.js                    # List all accessible files
 * node list-gdrive-files.js 1a2b3c4d5e6f7g8h   # List files in specific folder
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');

async function listFiles(folderId = null) {
  // Check credentials exist
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: google-credentials.json not found');
    console.error('');
    console.error('Please follow these steps:');
    console.error('1. Go to https://console.cloud.google.com');
    console.error('2. Create a Service Account');
    console.error('3. Download JSON credentials');
    console.error('4. Save as google-credentials.json in project root');
    console.error('');
    console.error('See GOOGLE_DRIVE_API_SETUP.md for detailed instructions.');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      Google Drive File Lister                        ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Load credentials
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  console.log(`✓ Authenticated as: ${credentials.client_email}`);
  console.log('');

  // Initialize Drive API
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Build query
  let query = "trashed=false";
  if (folderId) {
    query += ` and '${folderId}' in parents`;
    console.log(`Listing files in folder: ${folderId}`);
  } else {
    console.log('Listing all accessible files...');
  }
  console.log('');

  // List files
  const allFiles = [];
  let pageToken = null;
  let pageCount = 0;

  do {
    pageCount++;
    console.log(`Fetching page ${pageCount}...`);

    const res = await drive.files.list({
      pageSize: 100,
      pageToken,
      q: query,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, parents)',
    });

    const files = res.data.files || [];
    allFiles.push(...files);
    pageToken = res.data.nextPageToken;

    console.log(`  Found ${files.length} files on this page`);
  } while (pageToken);

  console.log('');
  console.log(`✓ Total files found: ${allFiles.length}`);
  console.log('');

  if (allFiles.length === 0) {
    console.log('⚠️  No files found!');
    console.log('');
    console.log('Possible reasons:');
    console.log('1. No files are shared with your service account');
    console.log('2. Wrong folder ID provided');
    console.log('');
    console.log('To share files:');
    console.log(`1. Right-click file/folder in Google Drive → Share`);
    console.log(`2. Add: ${credentials.client_email}`);
    console.log(`3. Set permission to "Viewer"`);
    return;
  }

  // Format data for Excel
  const excelData = allFiles.map(file => {
    const sizeBytes = file.size ? parseInt(file.size) : null;
    const sizeMb = sizeBytes ? (sizeBytes / 1024 / 1024).toFixed(2) : 'N/A';

    return {
      file_name: file.name,
      gdrive_file_id: file.id,
      gdrive_url: `https://drive.google.com/file/d/${file.id}/view`,
      mime_type: file.mimeType,
      size_mb: sizeMb,
      created: file.createdTime,
      modified: file.modifiedTime,
      // Placeholder columns for migration data
      project_uuid: '',
      document_type_uuid: '',
      document_date: '',
      document_no: '',
      document_value: '',
      currency_uuid: '',
    };
  });

  // Sort by name
  excelData.sort((a, b) => a.file_name.localeCompare(b.file_name));

  // Create Excel workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [
    { wch: 40 },  // file_name
    { wch: 35 },  // gdrive_file_id
    { wch: 60 },  // gdrive_url
    { wch: 30 },  // mime_type
    { wch: 10 },  // size_mb
    { wch: 20 },  // created
    { wch: 20 },  // modified
    { wch: 40 },  // project_uuid
    { wch: 40 },  // document_type_uuid
    { wch: 15 },  // document_date
    { wch: 20 },  // document_no
    { wch: 15 },  // document_value
    { wch: 40 },  // currency_uuid
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Files');

  // Write file
  const outputPath = 'gdrive-files-list.xlsx';
  XLSX.writeFile(wb, outputPath);

  console.log(`✅ Created: ${outputPath}`);
  console.log('');
  console.log('File includes:');
  console.log('  • file_name - Original file name');
  console.log('  • gdrive_file_id - File ID (use this in migration)');
  console.log('  • gdrive_url - Full Google Drive URL');
  console.log('  • mime_type - File type');
  console.log('  • size_mb - File size in megabytes');
  console.log('  • created/modified - Timestamps');
  console.log('');
  console.log('Empty columns for migration:');
  console.log('  • project_uuid - Fill with project UUID from reference-uuids.xlsx');
  console.log('  • document_type_uuid - Fill with document type UUID');
  console.log('  • currency_uuid - Fill with currency UUID');
  console.log('  • document_date - Document date');
  console.log('  • document_no - Document number');
  console.log('  • document_value - Monetary value');
  console.log('');
  console.log('Next steps:');
  console.log('1. Open gdrive-files-list.xlsx');
  console.log('2. Fill in the migration columns (project_uuid, etc.)');
  console.log('3. Save as your migration file');
  console.log('4. Run: node migrate-gdrive-attachments.js <your-file>.xlsx --dry-run');
  console.log('');

  // Show sample of files
  console.log('Sample files found:');
  excelData.slice(0, 10).forEach(f => {
    console.log(`  📄 ${f.file_name} (${f.size_mb} MB)`);
  });

  if (allFiles.length > 10) {
    console.log(`  ... and ${allFiles.length - 10} more files`);
  }
}

// Parse command line arguments
const folderId = process.argv[2] || null;

listFiles(folderId).catch(error => {
  console.error('');
  console.error('❌ Error:', error.message);
  
  if (error.code === 403) {
    console.error('');
    console.error('Access denied. Make sure:');
    console.error('1. Google Drive API is enabled in your project');
    console.error('2. Files/folders are shared with your service account');
  }
  
  process.exit(1);
});
