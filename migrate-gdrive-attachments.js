/**
 * Google Drive to Supabase Attachments Migration Script
 * 
 * PREREQUISITES:
 * 1. Excel file with columns mapping files to projects
 * 2. Google Drive files with shareable links
 * 3. Supabase storage bucket "payment-attachments" created
 * 
 * USAGE:
 * node migrate-gdrive-attachments.js <excel-file-path>
 * 
 * Example Excel columns (adapt COLUMN_MAPPING below):
 * - file_name: Original filename
 * - gdrive_url: Google Drive shareable link
 * - project_name or project_code: Project identifier
 * - document_type: Invoice, Contract, etc.
 * - document_date: Date on document
 * - document_no: Document reference number
 * - document_value: Monetary value
 * - currency_code: USD, GEL, EUR, etc.
 */

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ============= CONFIGURATION =============

// Adjust these column names to match your Excel file
const COLUMN_MAPPING = {
  fileName: 'file_name',           // Column with filename
  gdriveUrl: 'gdrive_url',         // Column with Google Drive link
  projectUuid: 'project_uuid',     // Column with project UUID (preferred)
  projectName: 'project_name',     // Alternative: project name
  projectCode: 'project_code',     // Alternative: project code
  documentType: 'document_type',   // Document type name
  documentDate: 'document_date',   // Document date
  documentNo: 'document_no',       // Document number
  documentValue: 'document_value', // Document value
  currencyCode: 'currency_code',   // Currency code (USD, GEL, etc.)
  documentTypeUuid: 'document_type_uuid', // Optional: direct document type UUID
  currencyUuid: 'currency_uuid',   // Optional: direct currency UUID
};

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = 'payment-attachments';

// ============= HELPERS =============

function convertGDriveUrlToDirectDownload(url) {
  // Convert various Google Drive URL formats to direct download
  if (!url) return null;
  
  // Extract file ID from various formats
  let fileId = null;
  
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const match1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match1) fileId = match1[1];
  
  // Format: https://drive.google.com/open?id=FILE_ID
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) fileId = match2[1];
  
  if (!fileId) {
    console.warn(`Could not extract file ID from: ${url}`);
    return null;
  }
  
  // Return direct download URL
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

async function downloadFile(url, tempPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(tempPath);
    
    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(tempPath);
        return downloadFile(response.headers.location, tempPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(tempPath);
        return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve(tempPath);
      });
    });
    
    request.on('error', (err) => {
      fs.unlinkSync(tempPath);
      reject(err);
    });
    
    file.on('error', (err) => {
      fs.unlinkSync(tempPath);
      reject(err);
    });
  });
}

function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

// ============= MIGRATION LOGIC =============

async function loadReferenceData() {
  console.log('Loading reference data...');
  
  const [projects, documentTypes, currencies] = await Promise.all([
    prisma.projects.findMany({
      select: { project_uuid: true, project_name: true, contract_no: true }
    }),
    prisma.document_types.findMany({
      where: { is_active: true },
      select: { uuid: true, name: true }
    }),
    prisma.currencies.findMany({
      where: { is_active: true },
      select: { uuid: true, code: true, name: true }
    })
  ]);
  
  console.log(`  - ${projects.length} projects`);
  console.log(`  - ${documentTypes.length} document types`);
  console.log(`  - ${currencies.length} currencies`);
  
  return {
    projectsByUuid: new Map(projects.map(p => [p.project_uuid, p])),
    projectsByName: new Map(projects.map(p => [p.project_name?.toLowerCase(), p])),
    projectsByCode: new Map(projects.map(p => [p.contract_no?.toLowerCase(), p])),
    documentTypesByUuid: new Map(documentTypes.map(dt => [dt.uuid, dt])),
    documentTypesByName: new Map(documentTypes.map(dt => [dt.name.toLowerCase(), dt])),
    currenciesByUuid: new Map(currencies.map(c => [c.uuid, c])),
    currenciesByCode: new Map(currencies.map(c => [c.code.toLowerCase(), c]))
  };
}

function parseExcelDate(excelDate) {
  if (!excelDate) return null;
  
  // If already a Date object
  if (excelDate instanceof Date) {
    return excelDate.toISOString().split('T')[0];
  }
  
  // If it's an Excel serial number
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  // If it's a string, try to parse
  if (typeof excelDate === 'string') {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed)) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return null;
}

async function migrateAttachment(row, refData, supabase, tempDir, dryRun = false) {
  const col = COLUMN_MAPPING;
  
  // Extract data from row
  const fileName = row[col.fileName];
  const gdriveUrl = row[col.gdriveUrl];
  
  // Project: Try UUID first, then fallback to name/code
  const projectUuid = row[col.projectUuid];
  const projectIdentifier = row[col.projectName] || row[col.projectCode];
  
  // Document type: Try UUID first, then fallback to name
  const documentTypeUuid = row[col.documentTypeUuid];
  const documentTypeName = row[col.documentType];
  
  // Currency: Try UUID first, then fallback to code
  const currencyUuid = row[col.currencyUuid];
  const currencyCode = row[col.currencyCode];
  
  // Other fields
  const documentDate = parseExcelDate(row[col.documentDate]);
  const documentNo = row[col.documentNo];
  const documentValue = row[col.documentValue] ? parseFloat(row[col.documentValue]) : null;
  
  if (!fileName || !gdriveUrl) {
    throw new Error('Missing required fields: file_name or gdrive_url');
  }
  
  console.log(`\n📄 Processing: ${fileName}`);
  
  // Handle project - UUID takes precedence
  let projectUuidFinal = null;
  if (projectUuid) {
    // Direct UUID provided - validate it exists
    const projectExists = refData.projectsByUuid.get(projectUuid);
    if (projectExists) {
      projectUuidFinal = projectUuid;
      console.log(`  ✓ Project UUID: ${projectUuid.substring(0, 8)}...`);
    } else {
      console.warn(`  ⚠️  Project UUID not found: ${projectUuid}`);
    }
  } else if (projectIdentifier) {
    // Lookup by name or code
    const identifier = projectIdentifier.toString().toLowerCase();
    const project = refData.projectsByName.get(identifier) || refData.projectsByCode.get(identifier);
    if (project) {
      projectUuidFinal = project.project_uuid;
      console.log(`  ✓ Project: ${project.project_name} (${project.contract_no || 'No contract'})`);
    } else {
      console.warn(`  ⚠️  Project not found: ${projectIdentifier}`);
    }
  }
  
  // Handle document type - UUID takes precedence
  let documentTypeUuidFinal = null;
  if (documentTypeUuid) {
    // Direct UUID provided - validate it exists
    const docTypeExists = refData.documentTypesByUuid.get(documentTypeUuid);
    if (docTypeExists) {
      documentTypeUuidFinal = documentTypeUuid;
      console.log(`  ✓ Document type UUID: ${documentTypeUuid.substring(0, 8)}...`);
    } else {
      console.warn(`  ⚠️  Document type UUID not found: ${documentTypeUuid}`);
    }
  } else if (documentTypeName) {
    // Lookup by name
    const docType = refData.documentTypesByName.get(documentTypeName.toLowerCase());
    if (docType) {
      documentTypeUuidFinal = docType.uuid;
      console.log(`  ✓ Document type: ${docType.name}`);
    } else {
      console.warn(`  ⚠️  Document type not found: ${documentTypeName}`);
    }
  }
  
  // Handle currency - UUID takes precedence
  let currencyUuidFinal = null;
  if (currencyUuid) {
    // Direct UUID provided - validate it exists
    const currencyExists = refData.currenciesByUuid.get(currencyUuid);
    if (currencyExists) {
      currencyUuidFinal = currencyUuid;
      console.log(`  ✓ Currency UUID: ${currencyUuid.substring(0, 8)}...`);
    } else {
      console.warn(`  ⚠️  Currency UUID not found: ${currencyUuid}`);
    }
  } else if (currencyCode) {
    // Lookup by code
    const currency = refData.currenciesByCode.get(currencyCode.toLowerCase());
    if (currency) {
      currencyUuidFinal = currency.uuid;
      console.log(`  ✓ Currency: ${currency.code}`);
    } else {
      console.warn(`  ⚠️  Currency not found: ${currencyCode}`);
    }
  }
  
  if (dryRun) {
    console.log(`  [DRY RUN] Would upload: ${fileName}`);
    return { success: true, dryRun: true };
  }
  
  // Download file from Google Drive
  const downloadUrl = convertGDriveUrlToDirectDownload(gdriveUrl);
  if (!downloadUrl) {
    throw new Error('Could not convert Google Drive URL to direct download');
  }
  
  const tempFilePath = path.join(tempDir, fileName);
  console.log(`  ⬇️  Downloading from Google Drive...`);
  await downloadFile(downloadUrl, tempFilePath);
  
  const fileStats = fs.statSync(tempFilePath);
  const fileHash = calculateFileHash(tempFilePath);
  console.log(`  ✓ Downloaded: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
  
  // Check if attachment already exists by hash
  const existingAttachment = await prisma.attachments.findFirst({
    where: { file_hash_sha256: fileHash }
  });
  
  if (existingAttachment) {
    console.log(`  ⚠️  File already exists (hash match): ${existingAttachment.uuid}`);
    fs.unlinkSync(tempFilePath);
    
    // Still create link to project if needed
    if (projectUuidFinal) {
      const existingLink = await prisma.attachment_links.findFirst({
        where: {
          attachment_uuid: existingAttachment.uuid,
          owner_table: 'projects',
          owner_uuid: projectUuidFinal
        }
      });
      
      if (!existingLink) {
        await prisma.attachment_links.create({
          data: {
            attachment_uuid: existingAttachment.uuid,
            owner_table: 'projects',
            owner_uuid: projectUuidFinal,
            is_primary: false
          }
        });
        console.log(`  ✓ Created link to project`);
      }
    }
    
    return { success: true, skipped: true, uuid: existingAttachment.uuid };
  }
  
  // Upload to Supabase Storage
  const fileBuffer = fs.readFileSync(tempFilePath);
  const mimeType = getMimeType(fileName);
  const storagePath = `migrations/${Date.now()}-${fileName}`;
  
  console.log(`  ⬆️  Uploading to Supabase...`);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: false
    });
  
  if (uploadError) {
    fs.unlinkSync(tempFilePath);
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }
  
  console.log(`  ✓ Uploaded to: ${STORAGE_BUCKET}/${storagePath}`);
  
  // Create attachment record
  const attachment = await prisma.attachments.create({
    data: {
      document_type_uuid: documentTypeUuidFinal,
      document_date: documentDate ? new Date(documentDate) : null,
      document_no: documentNo || null,
      document_value: documentValue,
      document_currency_uuid: currencyUuidFinal,
      storage_provider: 'supabase',
      storage_bucket: STORAGE_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: BigInt(fileStats.size),
      file_hash_sha256: fileHash,
      is_active: true
    }
  });
  
  console.log(`  ✓ Created attachment record: ${attachment.uuid}`);
  
  // Create link to project
  if (projectUuidFinal) {
    await prisma.attachment_links.create({
      data: {
        attachment_uuid: attachment.uuid,
        owner_table: 'projects',
        owner_uuid: projectUuidFinal,
        is_primary: false
      }
    });
    console.log(`  ✓ Linked to project`);
  }
  
  // Cleanup temp file
  fs.unlinkSync(tempFilePath);
  
  return { success: true, uuid: attachment.uuid };
}

function getMimeType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.zip': 'application/zip'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// ============= MAIN =============

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node migrate-gdrive-attachments.js <excel-file-path> [--dry-run]');
    console.error('');
    console.error('Example: node migrate-gdrive-attachments.js attachments.xlsx');
    console.error('         node migrate-gdrive-attachments.js attachments.xlsx --dry-run');
    process.exit(1);
  }
  
  const excelPath = args[0];
  const dryRun = args.includes('--dry-run');
  
  if (!fs.existsSync(excelPath)) {
    console.error(`Error: Excel file not found: ${excelPath}`);
    process.exit(1);
  }
  
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: Missing Supabase environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Google Drive to Supabase Attachment Migration      ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Excel file: ${excelPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log('');
  
  // Create temp directory
  const tempDir = path.join(__dirname, 'temp-downloads');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Load reference data
    const refData = await loadReferenceData();
    
    // Read Excel file
    console.log('\nReading Excel file...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${rows.length} rows in sheet: ${sheetName}`);
    console.log('');
    
    // Display column mapping
    console.log('Column mapping (verify these match your Excel):');
    Object.entries(COLUMN_MAPPING).forEach(([key, value]) => {
      const hasColumn = rows.length > 0 && value in rows[0];
      console.log(`  ${key}: "${value}" ${hasColumn ? '✓' : '✗ NOT FOUND'}`);
    });
    console.log('');
    
    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No files will be uploaded\n');
    }
    
    // Process each row
    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      console.log(`\n[${i + 1}/${rows.length}] ========================================`);
      
      try {
        const result = await migrateAttachment(row, refData, supabase, tempDir, dryRun);
        
        if (result.skipped) {
          results.skipped++;
        } else {
          results.success++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          fileName: row[COLUMN_MAPPING.fileName],
          error: error.message
        });
        console.error(`  ❌ Error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  Migration Summary                                   ║');
    console.log('╚══════════════════════════════════════════════════════╝');
    console.log(`Total rows:     ${rows.length}`);
    console.log(`✓ Success:      ${results.success}`);
    console.log(`⚠ Skipped:      ${results.skipped} (already exist)`);
    console.log(`❌ Failed:       ${results.failed}`);
    console.log('');
    
    if (results.errors.length > 0) {
      console.log('Errors:');
      results.errors.forEach(err => {
        console.log(`  Row ${err.row} (${err.fileName}): ${err.error}`);
      });
    }
    
    // Cleanup temp directory
    if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
      fs.rmdirSync(tempDir);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
