# Google Drive to Supabase Migration Guide

## Overview
This script migrates attachments from Google Drive to Supabase Storage and creates proper database records with links to projects.

## Prerequisites

### 1. Install Dependencies
```bash
pnpm install xlsx @supabase/supabase-js
```

### 2. Create Supabase Storage Bucket
If not already created, create a bucket named `payment-attachments` in your Supabase dashboard.

### 3. Prepare Your Excel File
Create an Excel file with the following columns (see template below):

| Column Name | Required | Description | Example |
|------------|----------|-------------|---------|
| file_name | ✅ Yes | Original filename | `contract_2024.pdf` |
| gdrive_url | ✅ Yes | Google Drive shareable link | `https://drive.google.com/file/d/ABC123/view` |
| project_name | No | Project name (for lookup) | `Vake Mall Project` |
| project_code | No | Project code (alternative lookup) | `PRJ-001` |
| document_type | No | Type from document_types table | `Contract` |
| document_date | No | Date on document | `2024-09-01` or Excel date |
| document_no | No | Document reference number | `DOC-2024-001` |
| document_value | No | Monetary value | `6011672.50` |
| currency_code | No | Currency code | `USD` |

**Note:** You can use either `project_name` OR `project_code` to identify the project.

## Excel Template

### Option A: Create manually
1. Open Excel
2. Create columns: `file_name`, `gdrive_url`, `project_name`, `document_type`, `document_date`, `document_no`, `document_value`, `currency_code`
3. Fill in your data
4. Save as `.xlsx`

### Option B: Sample row
```
file_name: Vake Mall Contract.pdf
gdrive_url: https://drive.google.com/file/d/1ABC123XYZ/view?usp=sharing
project_name: Vake Mall Project
document_type: Contract
document_date: 09/01/2025
document_no: CONTRACT-2025-001
document_value: 6011672.50
currency_code: USD
```

## Google Drive Setup

### Making files shareable:
1. Right-click file in Google Drive → Get link
2. Change to "Anyone with the link"
3. Copy the link (format: `https://drive.google.com/file/d/FILE_ID/view`)
4. Paste into `gdrive_url` column

### Supported URL formats:
- ✅ `https://drive.google.com/file/d/FILE_ID/view`
- ✅ `https://drive.google.com/open?id=FILE_ID`
- ✅ `https://drive.google.com/uc?id=FILE_ID`

## Configuration

### Adjust Column Mapping
If your Excel has different column names, edit `COLUMN_MAPPING` in the script:

```javascript
const COLUMN_MAPPING = {
  fileName: 'file_name',           // Your column name here
  gdriveUrl: 'gdrive_url',         // Your column name here
  projectName: 'project_name',     // Your column name here
  projectCode: 'project_code',     // Your column name here
  documentType: 'document_type',   // Your column name here
  documentDate: 'document_date',   // Your column name here
  documentNo: 'document_no',       // Your column name here
  documentValue: 'document_value', // Your column name here
  currencyCode: 'currency_code',   // Your column name here
};
```

## Usage

### 1. Dry Run (Test Mode)
Test the migration without actually uploading files:

```bash
node migrate-gdrive-attachments.js your-file.xlsx --dry-run
```

This will:
- ✅ Read the Excel file
- ✅ Validate column mapping
- ✅ Look up projects, document types, currencies
- ✅ Show what would be migrated
- ❌ NOT download or upload files

### 2. Live Migration
Run the actual migration:

```bash
node migrate-gdrive-attachments.js your-file.xlsx
```

This will:
- ⬇️ Download files from Google Drive
- ✅ Calculate file hashes (to detect duplicates)
- ⬆️ Upload to Supabase Storage
- ✅ Create `attachments` records
- ✅ Create `attachment_links` to projects
- ✅ Skip files that already exist (by hash)

## Script Features

### ✅ Duplicate Detection
- Files are hashed (SHA-256) before upload
- If a file with the same hash exists, it's skipped
- Existing files can still be linked to new projects

### ✅ Error Handling
- Individual file failures don't stop the migration
- Detailed error messages for each failed file
- Summary report at the end

### ✅ Project Lookup
- Looks up projects by name OR code
- Case-insensitive matching
- Warns if project not found (file still uploaded, just not linked)

### ✅ Reference Data Validation
- Validates document types against `document_types` table
- Validates currencies against `currencies` table
- Warns about missing reference data

### ✅ Date Parsing
- Handles Excel date serial numbers
- Handles string dates (ISO, US, etc.)
- Handles native Date objects

## Available Document Types
Current document types in the system:
- Act
- Agreement
- Certificate
- Contract
- Invoice
- Receipt
- Waybill

## Available Currencies
Current currencies in the system:
- AED, CNY, EUR, GBP, GEL, KZT, RUB, TRY, USD

## Example Output

```
╔══════════════════════════════════════════════════════╗
║  Google Drive to Supabase Attachment Migration      ║
╚══════════════════════════════════════════════════════╝

Excel file: project-attachments.xlsx
Mode: LIVE MIGRATION

Loading reference data...
  - 15 projects
  - 7 document types
  - 9 currencies

Reading Excel file...
Found 25 rows in sheet: Sheet1

Column mapping (verify these match your Excel):
  fileName: "file_name" ✓
  gdriveUrl: "gdrive_url" ✓
  projectName: "project_name" ✓
  documentType: "document_type" ✓
  ...

[1/25] ========================================

📄 Processing: Contract_VakeMall.pdf
  ✓ Project: Vake Mall Project (PRJ-001)
  ✓ Document type: Contract
  ✓ Currency: USD
  ⬇️  Downloading from Google Drive...
  ✓ Downloaded: 2.35 MB
  ⬆️  Uploading to Supabase...
  ✓ Uploaded to: payment-attachments/migrations/1744123456789-Contract_VakeMall.pdf
  ✓ Created attachment record: 9a7b8c9d-1e2f-3a4b-5c6d-7e8f9a0b1c2d
  ✓ Linked to project: Vake Mall Project

[2/25] ========================================
...

╔══════════════════════════════════════════════════════╗
║  Migration Summary                                   ║
╚══════════════════════════════════════════════════════╝
Total rows:     25
✓ Success:      20
⚠ Skipped:      3 (already exist)
❌ Failed:       2

Errors:
  Row 12 (document.pdf): Could not extract file ID from URL
  Row 18 (invoice.pdf): HTTP 403: Access denied
```

## Troubleshooting

### "Could not extract file ID from URL"
- Ensure Google Drive URL is properly formatted
- URL should contain the file ID

### "HTTP 403: Access denied"
- File is not publicly shared
- Right-click file → Get link → Change to "Anyone with the link"

### "Project not found"
- Project name/code doesn't match database
- Check spelling and capitalization
- File will still be uploaded, just not linked to project

### "Document type not found"
- Document type name doesn't match `document_types` table
- Check available types: Act, Agreement, Certificate, Contract, Invoice, Receipt, Waybill
- File will still be uploaded, just without document type

### "File already exists"
- File with same content hash already in database
- Migration will skip upload but create new project link if needed

## After Migration

### Verify in Database
```sql
-- Check attachments
SELECT COUNT(*) FROM attachments WHERE storage_provider = 'supabase';

-- Check links to projects
SELECT owner_table, COUNT(*) 
FROM attachment_links 
WHERE owner_table = 'projects'
GROUP BY owner_table;
```

### Verify in Supabase Dashboard
1. Go to Storage → payment-attachments
2. Check the `migrations/` folder
3. Verify files are uploaded

### View in Application
- Navigate to payments report
- Click attachment icon on any payment linked to the project
- Attachments should be visible

## Extending the Script

### Link to Other Entities
To link attachments to payments, jobs, or counteragents instead of projects, modify:

```javascript
// Change this:
owner_table: 'projects',
owner_uuid: project.uuid,

// To this (for payments):
owner_table: 'payments',
owner_uuid: payment.uuid,

// Or this (for jobs):
owner_table: 'jobs',
owner_uuid: job.uuid,
```

### Add Custom Metadata
Store additional information in the `metadata` JSON field:

```javascript
const attachment = await prisma.attachments.create({
  data: {
    // ... existing fields ...
    metadata: {
      original_source: 'Google Drive Migration',
      migration_date: new Date().toISOString(),
      notes: 'Imported from legacy system'
    }
  }
});
```

### Process Multiple Sheet Tabs
```javascript
// Instead of first sheet only:
const sheetName = workbook.SheetNames[0];

// Process specific sheet:
const sheetName = 'Contracts'; // or 'Invoices', etc.
```

## Cleanup

After successful migration, you can:
1. Delete the temp script: `Remove-Item migrate-gdrive-attachments.js`
2. Keep your Excel file for records
3. Update the Google Drive folder to archived/migrated status
