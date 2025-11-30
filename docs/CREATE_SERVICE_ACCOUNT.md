# How to Create a Google Service Account for Sheets API

## Step 1: Go to Google Cloud Console
Visit: https://console.cloud.google.com/

## Step 2: Select Your Project
Select project: **iceerp-469409**

## Step 3: Enable Google Sheets API
1. Go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click "Enable" if not already enabled

## Step 4: Create Service Account
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "Service account"
3. Fill in:
   - **Service account name**: `nbg-rates-sync`
   - **Service account ID**: `nbg-rates-sync` (auto-filled)
   - **Description**: "Service account for syncing NBG rates to Google Sheets"
4. Click "CREATE AND CONTINUE"
5. Skip "Grant this service account access to project" (click CONTINUE)
6. Skip "Grant users access to this service account" (click DONE)

## Step 5: Create and Download Key
1. Click on the newly created service account
2. Go to the "KEYS" tab
3. Click "ADD KEY" → "Create new key"
4. Select "JSON" format
5. Click "CREATE"
6. A JSON file will be downloaded - **save it to your project root**

## Step 6: Rename the Downloaded File
Rename the downloaded file to something simple like:
```
service-account-nbg.json
```

## Step 7: Update the Script
Update `scripts/sync-nbg-to-google-sheets.py` line 28:
```python
SERVICE_ACCOUNT_FILE = 'service-account-nbg.json'
```

## Step 8: Share Google Sheet with Service Account
1. Open the downloaded JSON file
2. Find the `client_email` field (looks like: `nbg-rates-sync@iceerp-469409.iam.gserviceaccount.com`)
3. Go to your Google Sheet
4. Click "Share" button
5. Paste the service account email
6. Give it "Editor" permissions
7. Uncheck "Notify people" (it's a bot account)
8. Click "Share"

## Step 9: Run the Script
Now you can run:
```bash
$env:SPREADSHEET_ID = "1C3w4OXGTX1uTn9-R0Rgqrx5oNDBt6T4lRL13rcgnIRM"
$env:SHEET_NAME = "Copy of NBG"
$env:REMOTE_DATABASE_URL = "postgresql://..."

python scripts/sync-nbg-to-google-sheets.py
```

## Your Current File
The file `client_secret_904189547818...json` is an **OAuth client secret**, not a service account.
- OAuth client secrets are for user authentication (sign in with Google)
- Service accounts are for server-to-server API access (what we need)

You need BOTH for different purposes:
- Keep `client_secret...json` for NextAuth Google login
- Create new service account for automated Sheets sync
