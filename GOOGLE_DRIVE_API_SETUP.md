# Google Drive API Setup Guide

This guide explains how to set up Google Drive API access for the attachment migration script.

## Overview

Since your Google Drive files are private, we need to use the Google Drive API with Service Account authentication. This allows the script to access files that are shared with a specific service account email.

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Enter project name (e.g., "Attachment Migration")
4. Click "Create"

### 2. Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and click "Enable"

### 3. Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in details:
   - **Service account name**: `attachment-migrator` (or any name)
   - **Service account ID**: Will be auto-generated
   - **Description**: "Service account for migrating attachments from Google Drive"
4. Click "Create and Continue"
5. Skip optional steps (roles, users) - click "Done"

### 4. Download Credentials JSON

1. In "Credentials" page, find your newly created service account
2. Click on the service account email
3. Go to "Keys" tab
4. Click "Add Key" → "Create new key"
5. Select "JSON" format
6. Click "Create"
7. **File will download automatically** - this is your credentials file!

### 5. Save Credentials File

1. Rename the downloaded file to `google-credentials.json`
2. Move it to your project root directory (same folder as `migrate-gdrive-attachments.js`)
3. **IMPORTANT**: Add to `.gitignore` to avoid committing secrets:
   ```
   google-credentials.json
   ```

### 6. Share Google Drive Files/Folders

This is the crucial step! Your service account needs permission to access your files.

1. Open the `google-credentials.json` file
2. Find the `client_email` field - it looks like:
   ```
   attachment-migrator@your-project-123456.iam.gserviceaccount.com
   ```
3. **Copy this email address**

4. In Google Drive:
   - Right-click your folder/files containing attachments
   - Click "Share"
   - Paste the service account email
   - Set permission to "Viewer" (read-only is enough)
   - Click "Share" (you may see a warning about external emails - that's OK)

**Alternative**: Share each file individually, but sharing the parent folder is easier.

### 7. Verify Setup

Your `google-credentials.json` should look like this (with real values):

```json
{
  "type": "service_account",
  "project_id": "your-project-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "attachment-migrator@your-project-123456.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## Install Dependencies

The script needs the Google APIs package:

```powershell
npm install googleapis
```

## Prepare Your Excel File

Your Excel file needs a `gdrive_file_id` column. You can provide:

1. **Just the file ID**: `1a2b3c4d5e6f7g8h9i0j`
2. **Full URL**: `https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view`

### How to Get File IDs from Google Drive

**Option 1: From URL**
1. Open the file in Google Drive
2. Look at the URL: `https://drive.google.com/file/d/FILE_ID_HERE/view`
3. Copy the FILE_ID_HERE part

**Option 2: Export from Google Drive** (Easier for many files)
1. Use Google Drive API to list files in your folder
2. See the helper script below

## Helper Script: List Files from Google Drive

Create `list-gdrive-files.js`:

```javascript
const { google } = require('googleapis');
const fs = require('fs');
const XLSX = require('xlsx');

async function listFiles() {
  const credentials = JSON.parse(fs.readFileSync('google-credentials.json', 'utf8'));
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  
  // List all files the service account can see
  const res = await drive.files.list({
    pageSize: 100,
    fields: 'files(id, name, mimeType, size, createdTime)',
  });
  
  const files = res.data.files.map(f => ({
    file_name: f.name,
    gdrive_file_id: f.id,
    mime_type: f.mimeType,
    size_mb: f.size ? (parseInt(f.size) / 1024 / 1024).toFixed(2) : 'N/A',
    created: f.createdTime
  }));
  
  // Export to Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(files);
  XLSX.utils.book_append_sheet(wb, ws, 'Files');
  XLSX.writeFile(wb, 'gdrive-files-list.xlsx');
  
  console.log(`✅ Found ${files.length} files`);
  console.log(`✅ Exported to: gdrive-files-list.xlsx`);
}

listFiles().catch(console.error);
```

Run it:
```powershell
node list-gdrive-files.js
```

This creates `gdrive-files-list.xlsx` with all files the service account can access. You can then:
1. Open this file
2. Add your project UUIDs and other metadata
3. Save as your migration file

## Troubleshooting

### Error: "File not found" (404)
- **Cause**: Service account doesn't have access to the file
- **Solution**: Make sure you shared the file/folder with the service account email

### Error: "Access denied" (403)
- **Cause**: Insufficient permissions
- **Solution**: 
  1. Check that Google Drive API is enabled
  2. Verify the file is shared with the service account email
  3. Make sure you gave at least "Viewer" permission

### Error: "google-credentials.json not found"
- **Cause**: Credentials file not in the correct location
- **Solution**: Move `google-credentials.json` to project root (same folder as the script)

### Error: "Invalid grant"
- **Cause**: Service account credentials might be expired or invalid
- **Solution**: Download a new JSON key from Google Cloud Console

## Security Notes

1. **Never commit `google-credentials.json` to git** - it contains private keys
2. Add to `.gitignore`:
   ```
   google-credentials.json
   temp-downloads/
   ```
3. The service account only has access to files you explicitly share with it
4. Consider rotating credentials periodically for security

## Next Steps

Once setup is complete:

1. ✅ Google credentials file saved as `google-credentials.json`
2. ✅ Files/folders shared with service account email
3. ✅ `googleapis` package installed
4. ✅ Excel file prepared with file IDs and project UUIDs

You're ready to run the migration! See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) for next steps.
