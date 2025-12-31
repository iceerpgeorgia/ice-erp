# Fix NBG Exchange Rates Auto-Import

## 🔍 Problem
The NBG exchange rates are not updating automatically via Vercel Cron Job.

## 📋 Current Configuration

**Cron Schedule** (in vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/update-nbg-rates",
      "schedule": "0 * * * *"
    }
  ]
}
```
- Runs **every hour** at the top of the hour
- Should fetch latest rates from NBG API
- Updates database with new rates

## ❌ Root Cause

The cron endpoint requires authentication via `CRON_SECRET` header, but this environment variable is likely:
1. Not set in Vercel
2. Or set incorrectly

When Vercel's cron system calls the endpoint, it fails the authentication check:
```typescript
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

## ✅ Solution

### Step 1: Set CRON_SECRET in Vercel

1. **Go to Vercel Dashboard**:
   - https://vercel.com/iceerpgeorgia/ice-erp/settings/environment-variables

2. **Add new environment variable**:
   - Name: `CRON_SECRET`
   - Value: Generate a secure random string (see below)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

3. **Generate secure secret** (run in terminal):
   ```powershell
   # PowerShell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
   
   Or use online: https://generate-secret.vercel.app/32

4. **Click "Save"**

### Step 2: Verify Cron Job is Enabled

1. **Check Vercel Cron Jobs**:
   - Go to: https://vercel.com/iceerpgeorgia/ice-erp/settings/cron-jobs
   - Verify `/api/cron/update-nbg-rates` is listed and enabled

2. **Check recent executions**:
   - Look for any error logs or failed attempts

### Step 3: Redeploy (if needed)

If the environment variable was just added, redeploy:
```powershell
git commit --allow-empty -m "chore: trigger redeploy for CRON_SECRET"
git push
```

### Step 4: Manual Test

Test the endpoint manually to verify it works:

```powershell
# Replace YOUR_CRON_SECRET with the actual secret
curl https://iceerpgeorgia.com/api/cron/update-nbg-rates `
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response:
```json
{
  "success": true,
  "message": "NBG rates updated successfully",
  "date": "2025-12-31",
  "ratesUpdated": 8
}
```

### Step 5: Verify Auto-Updates

After 1-2 hours, check if rates are being updated:

1. **Via UI**:
   - Go to: https://iceerpgeorgia.com/dictionaries/nbg-rates
   - Check the latest date in the table

2. **Via Script**:
   ```powershell
   node scripts/check-nbg-cron.js
   ```

## 🔧 Alternative: Change Cron Authentication

If you don't want to use CRON_SECRET, you can modify the endpoint to allow Vercel's cron system without authentication:

**Edit `app/api/cron/update-nbg-rates/route.ts`**:

```typescript
export async function GET(req: NextRequest) {
  try {
    // Option 1: Check for Vercel cron header instead
    const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');
    
    // Option 2: Or verify via Vercel's cron secret header
    const cronSecret = req.headers.get('x-vercel-cron');
    
    if (!isVercelCron && !cronSecret && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // ... rest of code
  }
}
```

## 📊 Check Current Status

Run this script to see current NBG rates status:
```powershell
node scripts/check-nbg-cron.js
```

It will show:
- Latest rate in database
- How old the data is
- Whether CRON_SECRET is set
- NBG API accessibility
- Diagnosis and fix recommendations

## 🎯 Expected Outcome

After setting CRON_SECRET:
- ✅ Cron job runs every hour
- ✅ NBG rates updated automatically
- ✅ Latest rates available within 1-2 hours of NBG publishing
- ✅ No manual updates needed

## 📝 Notes

- NBG publishes rates at **18:30 Georgian time** (14:30 UTC)
- Cron runs every hour, so rates should be updated by 15:00 UTC
- If rates are older than 2 days, check Vercel logs for errors
