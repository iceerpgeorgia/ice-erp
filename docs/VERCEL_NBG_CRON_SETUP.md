# Vercel Deployment - NBG Exchange Rates Cron Setup

## 🚀 Deployment Status

The application is configured to automatically deploy to Vercel when you push to the repository.

## ⏰ Automatic NBG Rates Update

### Cron Job Configuration

A Vercel Cron Job is configured in `vercel.json` to automatically update exchange rates from the NBG API:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-nbg-rates",
      "schedule": "0 19 * * *"
    }
  ]
}
```

**Schedule**: Daily at 19:00 UTC (equivalent to 23:00 Georgian time)
- NBG publishes rates at 18:30 Georgian time
- Cron runs at 23:00 Georgian time (19:00 UTC) to ensure rates are available

### Cron Endpoint

**Path**: `/api/cron/update-nbg-rates`

**Features**:
- ✅ Fetches latest rates from NBG API
- ✅ Creates new record or updates existing
- ✅ Fills missing dates (weekends/holidays) automatically
- ✅ Logs all actions to audit table
- ✅ Returns detailed execution summary

**Security**: Protected by `CRON_SECRET` environment variable

## 🔐 Required Environment Variables

Add these to your Vercel project settings:

### 1. Database Connection
```
DATABASE_URL=postgresql://postgres.xxx:password@xxx.pooler.supabase.com:6543/postgres
```

### 2. Cron Secret (Required for Cron Job)
```
CRON_SECRET=your-random-secret-string-here
```

**Generate a secret**:
```bash
# Option 1: Use OpenSSL
openssl rand -base64 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Use online generator
# https://randomkeygen.com/
```

### 3. Other Required Variables
```
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://iceerpgeorgia.com
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
```

## 📝 Setting Up Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - Name: `CRON_SECRET`
   - Value: Your generated secret
   - Environments: Production, Preview, Development
   - Click **Save**

## 🔍 Monitoring Cron Jobs

### View Cron Logs

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → Select latest deployment
3. Click **Functions** → Find `api/cron/update-nbg-rates`
4. View execution logs

### Check Last Execution

Visit your deployment logs or check the NBG rates table in your database:

```sql
SELECT MAX(date) as last_update, MAX(updated_at) as last_modified
FROM nbg_exchange_rates;
```

### Manual Trigger (for testing)

You can manually trigger the cron job:

```bash
curl -X GET https://iceerpgeorgia.com/api/cron/update-nbg-rates \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use the UI button: **"Update from NBG"** in `/dictionaries/nbg-rates`

## 📊 Cron Response Format

**Success Response**:
```json
{
  "success": true,
  "timestamp": "2025-11-12T19:00:00.000Z",
  "date": "2025-11-12",
  "action": "updated",
  "processedCurrencies": 8,
  "filledMissingDates": 0,
  "rates": {
    "usd": 2.7064,
    "eur": 3.1321,
    "cny": 0.38013,
    "gbp": 3.5557,
    "rub": 0.033255,
    "try": 0.0641,
    "aed": 0.73694,
    "kzt": 0.005153
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Failed to fetch from NBG API",
  "timestamp": "2025-11-12T19:00:00.000Z"
}
```

## 🛠️ Troubleshooting

### Cron Not Running

**Check**:
1. Verify `vercel.json` is in the root directory
2. Ensure latest deployment has the cron configuration
3. Check if `CRON_SECRET` is set in environment variables
4. View logs in Vercel Dashboard → Functions

### Cron Returns 401 Unauthorized

**Issue**: `CRON_SECRET` mismatch

**Fix**: 
1. Verify `CRON_SECRET` in Vercel settings
2. Redeploy to pick up new environment variable

### No Data Updated

**Possible Causes**:
1. NBG API is down (check https://nbg.gov.ge)
2. Weekend/holiday (NBG doesn't publish new rates)
3. Database connection issue

**Check Logs**:
```bash
# View recent logs
vercel logs [deployment-url]
```

### Database Connection Error

**Issue**: `DATABASE_URL` not accessible from Vercel

**Fix**:
1. Ensure Supabase allows connections from Vercel IPs
2. Use connection pooler URL (port 6543, not 5432)
3. Add `?pgbouncer=true` to connection string

## 📅 Cron Schedule Options

To change the schedule, update `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-nbg-rates",
      "schedule": "0 19 * * *"  // Daily at 19:00 UTC
    }
  ]
}
```

**Common schedules**:
- `0 19 * * *` - Daily at 19:00 UTC (23:00 Georgian)
- `0 18 * * 1-5` - Weekdays at 18:00 UTC (22:00 Georgian)
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight UTC

**Note**: Cron syntax uses UTC timezone. Calculate accordingly for Georgian time (UTC+4).

## ✅ Deployment Checklist

- [ ] Push code to GitHub
- [ ] Vercel automatically deploys
- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Set `DATABASE_URL` in Vercel environment variables
- [ ] Verify deployment succeeded
- [ ] Test cron endpoint manually
- [ ] Check first automatic execution (wait for scheduled time)
- [ ] Verify data in database after cron runs
- [ ] Monitor logs for any errors

## 🎯 Success Indicators

✅ Deployment shows "Ready" in Vercel dashboard  
✅ Environment variables all set  
✅ Cron job appears in Functions list  
✅ Manual trigger returns success response  
✅ Database shows new/updated rates after cron runs  
✅ Audit log shows cron actions  

## 📞 Support

If cron jobs don't work:
1. Check Vercel Dashboard → Functions → Logs
2. Verify database connectivity
3. Test NBG API directly: https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/
4. Review audit logs in database for any recorded actions

---

**Last Updated**: November 12, 2025  
**Status**: Ready for deployment  
**Cron Schedule**: Daily at 19:00 UTC (23:00 Georgian Time)
