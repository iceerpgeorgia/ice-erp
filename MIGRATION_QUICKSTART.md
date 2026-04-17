# Google Drive to Supabase Migration - Quick Start

## 📦 What I've Created for You

### 🎯 Main Scripts
1. **`migrate-gdrive-attachments.js`** - The main migration script
   - Downloads files from Google Drive
   - Uploads to Supabase Storage
   - Creates database records
   - Links files to projects
   - Handles duplicates and errors

2. **`validate-migration.js`** - Pre-migration validator
   - Checks Excel file structure
   - Validates data against database
   - Reports issues before migration
   - Provides detailed warnings

3. **`create-migration-template.js`** - Excel template generator
   - Creates properly formatted Excel file
   - Includes sample data
   - Shows all required/optional columns

4. **`setup-migration.ps1`** - One-command setup
   - Installs dependencies
   - Creates template
   - Validates environment

### 📚 Documentation
- **`MIGRATION_GUIDE.md`** - Complete migration guide with examples, troubleshooting, and configuration

## 🚀 Quick Start (5 Minutes)

### Step 1: Setup (1 min)
```powershell
.\setup-migration.ps1
```

This will:
- ✅ Install required npm packages (xlsx, @supabase/supabase-js)
- ✅ Create Excel template with sample data
- ✅ Check environment variables

### Step 2: Prepare Your Data (varies)
1. Open `attachment-migration-template.xlsx`
2. Replace sample rows with your actual data:
   - `file_name` - Filename from Google Drive
   - `gdrive_url` - Shareable Google Drive link
   - `project_name` - Your project name (or `project_code`)
   - `document_type` - Contract, Invoice, etc.
   - `document_date` - Date on document
   - Other optional fields...

### Step 3: Make Files Shareable
For each file in Google Drive:
1. Right-click → Get link
2. Change to "Anyone with the link"
3. Copy URL to Excel

### Step 4: Validate (1 min)
```bash
node validate-migration.js attachment-migration-template.xlsx
```

This checks:
- ✅ Required columns present
- ✅ Valid Google Drive URLs
- ✅ Projects exist in database
- ✅ Document types and currencies valid
- ✅ Data format correct

### Step 5: Test Migration (dry run)
```bash
node migrate-gdrive-attachments.js attachment-migration-template.xlsx --dry-run
```

This shows what **would** happen without actually migrating.

### Step 6: Run Migration
```bash
node migrate-gdrive-attachments.js attachment-migration-template.xlsx
```

Watch the progress! 🎉

## 📋 Excel Template Structure

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **file_name** | ✅ Yes | Filename | `contract_2024.pdf` |
| **gdrive_url** | ✅ Yes | Google Drive link | `https://drive.google.com/file/d/ABC.../view` |
| project_name | No | Project name | `Vake Mall Project` |
| project_code | No | Project code | `PRJ-001` |
| document_type | No | Type | `Contract` |
| document_date | No | Date | `2025-09-01` |
| document_no | No | Ref number | `DOC-2024-001` |
| document_value | No | Amount | `6011672.50` |
| currency_code | No | Currency | `USD` |

## 🎯 Available Reference Data

### Document Types (7)
- Act
- Agreement
- Certificate
- Contract
- Invoice
- Receipt
- Waybill

### Currencies (9)
- AED, CNY, EUR, GBP, GEL, KZT, RUB, TRY, USD

## ⚙️ Configuration

If your Excel has different column names, edit the `COLUMN_MAPPING` section in `migrate-gdrive-attachments.js`:

```javascript
const COLUMN_MAPPING = {
  fileName: 'file_name',     // ← Change to your column name
  gdriveUrl: 'gdrive_url',   // ← Change to your column name
  // ... etc
};
```

## 🔍 What Happens During Migration

1. **Reads Excel** - Parses your spreadsheet
2. **Validates** - Checks data and looks up projects
3. **Downloads** - Gets files from Google Drive (temporary)
4. **Hashes** - Calculates SHA-256 to detect duplicates
5. **Uploads** - Sends to Supabase Storage (`payment-attachments` bucket)
6. **Creates Records** - Adds to `attachments` table
7. **Links** - Creates `attachment_links` to projects
8. **Cleanup** - Removes temporary files

## 🛡️ Safety Features

- ✅ **Duplicate Detection** - Won't re-upload same file (by hash)
- ✅ **Error Isolation** - One failure doesn't stop everything
- ✅ **Dry Run Mode** - Test before actually migrating
- ✅ **Detailed Logging** - See exactly what's happening
- ✅ **Summary Report** - Know what succeeded/failed

## 📊 Example Output

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

[1/25] ========================================
📄 Processing: Contract_VakeMall.pdf
  ✓ Project: Vake Mall Project (PRJ-001)
  ✓ Document type: Contract
  ✓ Currency: USD
  ⬇️  Downloading from Google Drive...
  ✓ Downloaded: 2.35 MB
  ⬆️  Uploading to Supabase...
  ✓ Created attachment record
  ✓ Linked to project

╔══════════════════════════════════════════════════════╗
║  Migration Summary                                   ║
╚══════════════════════════════════════════════════════╝
Total rows:     25
✓ Success:      20
⚠ Skipped:      3 (already exist)
❌ Failed:       2
```

## 🆘 Troubleshooting

### "Project not found"
**Fix:** Check project name/code matches database exactly (case-insensitive)
**Note:** File will still upload, just not linked to project

### "HTTP 403: Access denied"
**Fix:** Make sure Google Drive file is shared ("Anyone with the link")

### "Document type not found"
**Fix:** Use one of: Act, Agreement, Certificate, Contract, Invoice, Receipt, Waybill
**Note:** File will still upload, just without document type

### "Could not extract file ID"
**Fix:** Ensure URL format is: `https://drive.google.com/file/d/FILE_ID/view`

## 🔗 Where Files Are Stored

- **Supabase Storage:** `payment-attachments/migrations/[timestamp]-[filename]`
- **Database:** `attachments` table (with all metadata)
- **Links:** `attachment_links` table (linked to projects)

## 🧹 After Migration

### Verify Success
```bash
# Check in database
node -e "require('@prisma/client').PrismaClient().attachments.count().then(c => console.log('Attachments:', c))"
```

### View in App
1. Go to Payments Report
2. Click attachment icon on any payment
3. Your migrated files should appear

### Cleanup (optional)
```powershell
# Remove migration scripts (keep Excel for records)
Remove-Item migrate-gdrive-attachments.js, validate-migration.js, create-migration-template.js, setup-migration.ps1
```

## 📝 Notes

- Files are **copied**, not moved (originals stay in Google Drive)
- Migration is **idempotent** (safe to run multiple times)
- Duplicate files are detected by hash and skipped
- Links can be created to any table (payments, jobs, counteragents, etc.)

## 💡 Need Help?

See detailed guide: **`MIGRATION_GUIDE.md`**
