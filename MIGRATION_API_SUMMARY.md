# Google Drive API Migration - Setup Summary

## What Changed

The migration system now uses **Google Drive API** instead of public shareable links, allowing you to migrate private files.

## New Files Created

1. **migrate-gdrive-attachments.js** (UPDATED)
   - Now uses Google Drive API instead of direct HTTP download
   - Requires `googleapis` package
   - Requires `google-credentials.json` service account file

2. **list-gdrive-files.js** (NEW)
   - Helper script to list all files the service account can access
   - Exports to Excel with file IDs already filled in
   - Makes migration prep much easier

3. **GOOGLE_DRIVE_API_SETUP.md** (NEW)
   - Step-by-step guide for Google Cloud setup
   - How to create service account
   - How to download and save credentials
   - How to share files with service account

4. **GDRIVE_API_QUICKSTART.md** (NEW)
   - Quick 5-step setup guide
   - All commands in one place
   - Troubleshooting common errors

5. **.gitignore.migration** (NEW)
   - Security rules for migration files
   - Add these entries to your main .gitignore

6. **create-migration-template.js** (UPDATED)
   - Changed from `gdrive_url` to `gdrive_file_id`
   - Supports both file IDs and full URLs

## Dependencies Required

Install these packages:

```powershell
npm install googleapis
```

(xlsx and @supabase/supabase-js should already be installed)

## Key Changes in Excel Format

| Old Column    | New Column        | Notes                              |
|---------------|-------------------|------------------------------------|
| `gdrive_url`  | `gdrive_file_id`  | Can be file ID OR full URL         |

Example values:
- File ID only: `1a2b3c4d5e6f7g8h9i0j`
- Full URL: `https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view`

Both formats work!

## Setup Steps (Quick Reference)

### 1. Google Cloud Setup (~5 minutes)
1. Create project at https://console.cloud.google.com
2. Enable Google Drive API
3. Create Service Account
4. Download JSON credentials
5. Save as `google-credentials.json` in project root

### 2. Share Files (~2 minutes)
1. Open `google-credentials.json` → find `client_email`
2. Share your Google Drive folder with that email
3. Set permission to "Viewer"

### 3. Install & Export (~1 minute)
```powershell
npm install googleapis
node export-reference-uuids.js
node list-gdrive-files.js
```

### 4. Prepare Migration File (~varies)
1. Open `gdrive-files-list.xlsx` (has your files + IDs)
2. Open `reference-uuids.xlsx` (has your projects)
3. Match files to projects
4. Save as `my-migration.xlsx`

### 5. Run Migration
```powershell
# Test first
node migrate-gdrive-attachments.js my-migration.xlsx --dry-run

# Validate
node validate-migration.js my-migration.xlsx

# Run for real
node migrate-gdrive-attachments.js my-migration.xlsx
```

## Security Checklist

Before committing anything, add to `.gitignore`:

```
google-credentials.json
temp-downloads/
gdrive-files-list.xlsx
my-migration.xlsx
```

## What Happens During Migration

```
For each file in Excel:
1. Authenticate with Google Drive API
2. Download file from Google Drive → temp folder
3. Calculate SHA-256 hash (duplicate detection)
4. Upload to Supabase Storage (payment-attachments/migrations/)
5. Create attachments table record
6. Create attachment_links to project
7. Delete temp file
```

## Error Messages Explained

| Error                     | Cause                                  | Fix                                           |
|---------------------------|----------------------------------------|-----------------------------------------------|
| "File not found" (404)    | File not shared with service account   | Share file/folder with service account email  |
| "Access denied" (403)     | API not enabled or no permission       | Enable Drive API, check share settings        |
| "google-credentials.json not found" | Wrong location           | Move to project root                          |
| "Invalid grant"           | Credentials expired                    | Download new JSON key                         |

## File Structure After Migration

```
Project Root:
├── google-credentials.json       (git-ignored, your secret!)
├── migrate-gdrive-attachments.js (updated with API)
├── list-gdrive-files.js          (new helper)
├── export-reference-uuids.js     (existing)
├── validate-migration.js         (existing)
├── create-migration-template.js  (updated column name)
├── gdrive-files-list.xlsx        (generated, git-ignored)
├── reference-uuids.xlsx          (generated, OK to commit)
└── my-migration.xlsx             (your working file, git-ignored)

Supabase Storage:
└── payment-attachments/
    └── migrations/
        ├── contract-2024-001.pdf
        ├── invoice-2024-045.pdf
        └── ...

Database:
├── attachments (file metadata, hashes, UUIDs)
└── attachment_links (project ↔ attachment relationships)
```

## Benefits of Google Drive API Approach

✅ **Works with private files** (no need to make public)
✅ **More secure** (service account has minimal permissions)
✅ **Better error messages** (404, 403 vs generic HTTP errors)
✅ **Automatic file listing** (list-gdrive-files.js)
✅ **Handles large files** (streaming download)
✅ **Duplicate detection** (SHA-256 hash)
✅ **Idempotent** (safe to run multiple times)

## Next Steps

1. **Install dependencies**: `npm install googleapis`
2. **Read setup guide**: [GOOGLE_DRIVE_API_SETUP.md](GOOGLE_DRIVE_API_SETUP.md)
3. **Follow quickstart**: [GDRIVE_API_QUICKSTART.md](GDRIVE_API_QUICKSTART.md)
4. **Start migration**: Complete steps 1-5 above

## Need Help?

- Detailed setup: [GOOGLE_DRIVE_API_SETUP.md](GOOGLE_DRIVE_API_SETUP.md)
- Quick commands: [GDRIVE_API_QUICKSTART.md](GDRIVE_API_QUICKSTART.md)
- Advanced options: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- Schema details: Search codebase for "attachments" table

## Questions?

- "Do I need a Google Workspace account?" → No, personal Gmail works
- "Will this cost money?" → Google Drive API has generous free tier
- "Can I migrate 1000s of files?" → Yes, no hard limit
- "What if file already exists?" → Detects by hash, skips duplicate
- "Can I undo?" → Yes, delete from Supabase Storage and database
