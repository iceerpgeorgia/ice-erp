# Google Drive Migration - UUID-Based Quick Start

## 🎯 Simplified Process with UUIDs

Since you have all the necessary fields including project UUIDs, the migration is straightforward!

## 📦 Step-by-Step Guide

### Step 1: Setup (1 minute)
```powershell
# Install dependencies
pnpm install xlsx @supabase/supabase-js

# Export reference UUIDs from your database
node export-reference-uuids.js
```

This creates **`reference-uuids.xlsx`** with 3 sheets:
- **Projects** - All project UUIDs
- **Document Types** - Contract, Invoice, etc. UUIDs
- **Currencies** - USD, GEL, EUR, etc. UUIDs

### Step 2: Prepare Your Excel File

Your Excel should have these columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **file_name** | ✅ Yes | Filename | `contract.pdf` |
| **gdrive_url** | ✅ Yes | Google Drive link | `https://drive.google.com/file/d/ABC.../view` |
| **project_uuid** | ✅ Recommended | Project UUID | `12345678-1234-5678-1234-567812345678` |
| **document_type_uuid** | No | Document type UUID | `ad073cad-2b77-437b-aa2d-c61d9042d583` |
| **currency_uuid** | No | Currency UUID | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| **document_date** | No | Date | `2025-09-01` |
| **document_no** | No | Reference | `DOC-2024-001` |
| **document_value** | No | Amount | `6011672.50` |

**💡 Tip:** Open `reference-uuids.xlsx` alongside your migration Excel. Use VLOOKUP or copy-paste UUIDs directly!

### Step 3: Make Google Drive Files Shareable

For each file:
1. Right-click in Google Drive → **Get link**
2. Change to **"Anyone with the link"**
3. Copy URL to Excel `gdrive_url` column

### Step 4: Validate Your Excel

```bash
node validate-migration.js your-file.xlsx
```

This checks:
- ✅ Required columns present
- ✅ UUIDs are valid and exist in database
- ✅ Google Drive URLs are properly formatted
- ✅ Data types are correct

### Step 5: Dry Run Test

```bash
node migrate-gdrive-attachments.js your-file.xlsx --dry-run
```

Shows what **would** happen without actually migrating. Check the output!

### Step 6: Run Migration

```bash
node migrate-gdrive-attachments.js your-file.xlsx
```

Watch the progress! The script will:
1. ⬇️ Download each file from Google Drive
2. ✅ Calculate hash (detect duplicates)
3. ⬆️ Upload to Supabase Storage
4. ✅ Create `attachments` record
5. ✅ Create `attachment_links` to projects
6. 🧹 Cleanup temporary files

## 📋 Example Excel Row

```
file_name:          Vake_Mall_Contract.pdf
gdrive_url:         https://drive.google.com/file/d/1ABC123.../view
project_uuid:       d34ef8a6-f796-4cea-bb24-44a3f5322060
document_type_uuid: ad073cad-2b77-437b-aa2d-c61d9042d583
document_date:      2025-09-01
document_no:        CONTRACT-2025-001
document_value:     6011672.50
currency_uuid:      f47ac10b-58cc-4372-a567-0e02b2c3d479
```

## 🎯 Where to Get UUIDs

### Option 1: Use the Excel Export
```bash
node export-reference-uuids.js
```

Then open `reference-uuids.xlsx` and look up by name.

### Option 2: Query Database Directly
```sql
-- Get project UUIDs
SELECT uuid, project_name, project_number FROM projects ORDER BY project_name;

-- Get document type UUIDs  
SELECT uuid, name FROM document_types WHERE is_active = true ORDER BY name;

-- Get currency UUIDs
SELECT uuid, code, name FROM currencies WHERE is_active = true ORDER BY code;
```

### Option 3: Use Prisma Studio
```bash
pnpm prisma studio
```

Browse `projects`, `document_types`, and `currencies` tables visually.

## 🔧 Column Mapping in Script

The script looks for these exact column names by default:

```javascript
file_name           // Required
gdrive_url          // Required
project_uuid        // UUID of project
document_type_uuid  // UUID of document type
currency_uuid       // UUID of currency
document_date       // Date on document
document_no         // Document reference number
document_value      // Monetary amount
```

**Different column names?** Edit `COLUMN_MAPPING` in `migrate-gdrive-attachments.js`:

```javascript
const COLUMN_MAPPING = {
  fileName: 'file_name',                    // ← Your column name
  gdriveUrl: 'gdrive_url',                  // ← Your column name
  projectUuid: 'project_uuid',              // ← Your column name
  documentTypeUuid: 'document_type_uuid',   // ← Your column name
  // ... etc
};
```

## 📊 Example Migration Output

```
╔══════════════════════════════════════════════════════╗
║  Google Drive to Supabase Attachment Migration      ║
╚══════════════════════════════════════════════════════╝

Excel file: attachments.xlsx
Mode: LIVE MIGRATION

Loading reference data...
  - 15 projects
  - 7 document types
  - 9 currencies

[1/25] ========================================
📄 Processing: Contract_VakeMall.pdf
  ✓ Project UUID: d34ef8a6...
  ✓ Document type UUID: ad073cad...
  ✓ Currency UUID: f47ac10b...
  ⬇️  Downloading from Google Drive...
  ✓ Downloaded: 2.35 MB
  ⬆️  Uploading to Supabase...
  ✓ Uploaded to: payment-attachments/migrations/1744123456789-Contract_VakeMall.pdf
  ✓ Created attachment record: 9a7b8c9d-1e2f-3a4b-5c6d-7e8f9a0b1c2d
  ✓ Linked to project

╔══════════════════════════════════════════════════════╗
║  Migration Summary                                   ║
╚══════════════════════════════════════════════════════╝
Total rows:     25
✓ Success:      22
⚠ Skipped:      2 (already exist)
❌ Failed:       1

Errors:
  Row 12 (doc.pdf): HTTP 403: Access denied
```

## 🛡️ Safety Features

- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Duplicate Detection** - Won't upload same file twice (by hash)
- ✅ **Error Isolation** - One failure doesn't stop everything
- ✅ **Validation** - Checks UUIDs exist before uploading
- ✅ **Dry Run** - Test before committing
- ✅ **Automatic Cleanup** - Removes temporary files

## 🆘 Common Issues

### "Project UUID not found"
**Fix:** Check `reference-uuids.xlsx` → Projects sheet for correct UUID

### "HTTP 403: Access denied"
**Fix:** Make Google Drive file shareable ("Anyone with the link")

### "Could not extract file ID"
**Fix:** Ensure URL is format: `https://drive.google.com/file/d/FILE_ID/view`

### "Document type UUID not found"
**Fix:** Use UUID from `reference-uuids.xlsx` → Document Types sheet

## ✅ After Migration

### Verify in Database
```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.attachments.count().then(c=>console.log('Total attachments:',c))"
```

### View in Application
1. Go to Payments Report
2. Click attachment icon
3. Your files should appear!

## 🧹 Cleanup (Optional)

After successful migration:
```powershell
# Remove migration scripts
Remove-Item migrate-gdrive-attachments.js, validate-migration.js, export-reference-uuids.js

# Keep your Excel files for records!
```

## 📝 Notes

- Files stay in Google Drive (they're copied, not moved)
- UUIDs must be **exact string match** (including dashes)
- Migration creates files in `payment-attachments/migrations/` folder
- Duplicate files (by hash) are automatically skipped
- Can link same file to multiple projects by running multiple times

## 💡 Advanced: Link to Other Entities

To link attachments to **payments**, **jobs**, or **counteragents** instead of projects:

Edit the script where it creates links:
```javascript
// Change owner_table and owner_uuid
owner_table: 'payments',     // or 'jobs', 'counteragents', etc.
owner_uuid: paymentUuidFinal // from your Excel
```

---

**Need more help?** See full guide: `MIGRATION_GUIDE.md`
