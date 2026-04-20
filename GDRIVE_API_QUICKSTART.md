# Google Drive Attachment Migration - Quick Start

Complete guide for migrating private Google Drive files to Supabase using Google Drive API.

## Prerequisites

- Node.js installed
- Google Drive account with files to migrate
- Supabase project with `payment-attachments` bucket
- Local PostgreSQL database with Prisma

## Quick Setup (5 Steps)

### Step 1: Install Dependencies

```powershell
npm install googleapis xlsx @supabase/supabase-js
```

### Step 2: Set Up Google Drive API

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project (e.g., "Attachment Migration")

2. **Enable Google Drive API**
   - Go to "APIs & Services" → "Library"
   - Search "Google Drive API" → Enable

3. **Create Service Account**
   - Go to "APIs & Services" → "Credentials"
   - Create Credentials → Service Account
   - Name it `attachment-migrator` → Create

4. **Download Credentials**
   - Click on the service account email
   - Go to "Keys" tab → "Add Key" → "Create new key" → JSON
   - Save downloaded file as `google-credentials.json` in project root

5. **Get Service Account Email**
   - Open `google-credentials.json`
   - Find `client_email` (looks like: `attachment-migrator@your-project.iam.gserviceaccount.com`)
   - **Copy this email - you'll need it in Step 3**

### Step 3: Share Google Drive Files

1. In Google Drive, right-click your folder containing attachments
2. Click "Share"
3. Paste the service account email from Step 2.5
4. Set permission to "Viewer"
5. Click "Share" (ignore warning about external email)

### Step 4: Generate File List

Run this to see what files the service account can access:

```powershell
node list-gdrive-files.js
```

This creates `gdrive-files-list.xlsx` with all accessible files and their IDs.

### Step 5: Export Reference UUIDs

Get your database UUIDs for mapping:

```powershell
node export-reference-uuids.js
```

This creates `reference-uuids.xlsx` with:
- 995 projects (project_uuid, project_name, contract_no)
- 7 document types (Contract, Invoice, Agreement, etc.)
- 9 currencies (USD, GEL, EUR, etc.)

## Prepare Migration File

### Option A: Use Generated File List (Recommended)

1. Open `gdrive-files-list.xlsx` (from Step 4)
2. Open `reference-uuids.xlsx` (from Step 5) in another window
3. For each file in `gdrive-files-list.xlsx`:
   - Find the project in `reference-uuids.xlsx`
   - Copy the `project_uuid` to the file's row
   - Copy `document_type_uuid` for the document type (e.g., Contract, Invoice)
   - Copy `currency_uuid` if the document has a monetary value
   - Fill in `document_date`, `document_no`, `document_value` if applicable
4. Save as `my-migration.xlsx`

The file already has `gdrive_file_id` filled in for you!

### Option B: Create Manual Mapping

If you have your own mapping table:

1. Run `node create-migration-template.js` to get a template
2. Fill in columns:
   - `file_name` - Original filename (required)
   - `gdrive_file_id` - File ID from Google Drive (required)
   - `project_uuid` - From `reference-uuids.xlsx` (optional)
   - `document_type_uuid` - From `reference-uuids.xlsx` (optional)
   - `document_date` - Date on document (optional)
   - `document_no` - Document reference number (optional)
   - `document_value` - Monetary amount (optional)
   - `currency_uuid` - From `reference-uuids.xlsx` (optional)

## How to Get Google Drive File IDs

### From URL
Open file in Google Drive, URL looks like:
```
https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view
                              ^^^^^^^^^^^^^^^^^^^^
                              This is the file ID
```

### From Folder
If all files are in one folder, get the folder ID from URL:
```
https://drive.google.com/drive/folders/1aBcD3FgH5jKlM
                                        ^^^^^^^^^^^^^^
                                        This is folder ID
```

Then run:
```powershell
node list-gdrive-files.js 1aBcD3FgH5jKlM
```

## Run Migration

### Dry Run (Test First)

```powershell
node migrate-gdrive-attachments.js my-migration.xlsx --dry-run
```

This validates the file without downloading or uploading anything.

### Validation

```powershell
node validate-migration.js my-migration.xlsx
```

Checks:
- Required columns exist
- UUIDs are valid and exist in database
- File IDs are properly formatted

### Live Migration

```powershell
node migrate-gdrive-attachments.js my-migration.xlsx
```

What happens:
1. ✅ Authenticates with Google Drive API
2. ✅ Downloads each file from Google Drive
3. ✅ Calculates SHA-256 hash (detects duplicates)
4. ✅ Uploads to Supabase Storage (`payment-attachments/migrations/`)
5. ✅ Creates record in `attachments` table
6. ✅ Links to project via `attachment_links` table
7. ✅ Cleans up temp files

## Troubleshooting

### "File not found" (404)
**Problem**: Service account can't access the file
**Solution**: Make sure file/folder is shared with service account email

### "Access denied" (403)
**Problem**: API not enabled or insufficient permissions
**Solution**: 
1. Check Google Drive API is enabled
2. Verify file is shared with service account
3. Ensure "Viewer" permission granted

### "google-credentials.json not found"
**Problem**: Credentials file in wrong location
**Solution**: Move `google-credentials.json` to project root

### "Invalid grant"
**Problem**: Credentials expired
**Solution**: Download new JSON key from Google Cloud Console

### Files not appearing in list-gdrive-files.js
**Problem**: Not shared with service account
**Solution**: Double-check you shared with the exact email from `google-credentials.json`

## File Structure After Migration

```
Supabase Storage: payment-attachments/migrations/<filename>
Database Table: attachments (metadata, hash, UUID)
Links Table: attachment_links (attachment ↔ project)
```

Each attachment gets:
- Unique UUID
- SHA-256 hash (prevents duplicates)
- Link to project (if project_uuid provided)
- Document metadata (type, date, number, value, currency)

## Security Checklist

- ✅ Add `google-credentials.json` to `.gitignore`
- ✅ Add `temp-downloads/` to `.gitignore`
- ✅ Never commit credentials to git
- ✅ Service account has minimal permissions (Drive read-only)
- ✅ Rotate credentials periodically

## Summary of Commands

```powershell
# 1. Install dependencies
npm install googleapis xlsx @supabase/supabase-js

# 2. List your Google Drive files
node list-gdrive-files.js

# 3. Export database UUIDs
node export-reference-uuids.js

# 4. (Optional) Create empty template
node create-migration-template.js

# 5. Validate your migration file
node validate-migration.js my-migration.xlsx

# 6. Test migration (dry run)
node migrate-gdrive-attachments.js my-migration.xlsx --dry-run

# 7. Run actual migration
node migrate-gdrive-attachments.js my-migration.xlsx
```

## Need More Details?

See [GOOGLE_DRIVE_API_SETUP.md](GOOGLE_DRIVE_API_SETUP.md) for detailed Google Cloud setup instructions.

See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for advanced migration options and column mapping.
