# BOG Bank Transaction Cron Job - Setup & Resume Guide

## Current Status

**Issue**: Bank transaction cron job is **NOT RUNNING** because credentials are missing.

```
BOG_CREDENTIALS_MAP=""  ❌ EMPTY - This needs to be configured!
```

## What Needs to Be Done

### Phase 1: Configure BOG Credentials (One-time Setup)

Choose **one of these options**:

#### Option A: Multi-Insider Credentials (Recommended)
Set `BOG_CREDENTIALS_MAP` in Vercel environment variables:

```json
[
  {
    "insiderUuid": "your-insider-uuid-1",
    "accessToken": "your-static-token-1"
  },
  {
    "insiderUuid": "your-insider-uuid-2",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret"
  }
]
```

**Where to get these values**:
- `insiderUuid`: Unique ID for your ICE insider account
- `accessToken`: Static BOG API token (if available)
- `clientId` + `clientSecret`: OAuth credentials from BOG

#### Option B: Legacy Credentials
Set these in Vercel environment variables:

```
BOG_CLIENT_ID=your-client-id
BOG_CLIENT_SECRET=your-client-secret
```

#### Option C: Static Access Token
Set this in Vercel environment variables:

```
BOG_ACCESS_TOKEN=your-static-token
```

### Phase 2: Set Environment Variables in Vercel

1. Go to: https://vercel.com/dashboard/ice-erp/settings/environment-variables
2. Add the appropriate credentials from Phase 1
3. Make sure they're applied to "Production" environment
4. Deployment will automatically use the updated credentials

### Phase 3: Verify Configuration (Local Test)

After setting credentials in Vercel, test locally:

```bash
# First, pull latest environment from Vercel
vercel env pull

# Then run the test
node _bog_backfill.js
```

Expected output:
```
✓ CRON_SECRET: ✓ SET
✓ BOG_CREDENTIALS_MAP: ✓ SET (...)
```

### Phase 4: Fill Missing Transactions (Last 30 Days)

Run the backfill script to import transactions from the last month:

```bash
# Last 30 days (default)
node _bog_backfill.js

# Last 60 days
node _bog_backfill.js 60

# Custom date range
node _bog_backfill.js --start 2026-06-01 --end 2026-07-31
```

Expected output:
```
🚀 BOG BANK TRANSACTION BACKFILL
📅 Lookback Period: Last 30 days
⏳ Triggering backfill endpoint...
📊 BACKFILL RESULTS:
✅ SUCCESS
   Total transactions imported: X,XXX
   Successful days: 30
   Failed days: 0
```

### Phase 5: Verify Automatic Cron Continues

The cron job will now automatically run:
- **Schedule**: Daily at 3 AM UTC (7 AM Tbilisi)
- **What it does**: Fetches BOG transactions from last 3 days and imports them
- **Configuration**: Set `BOG_CRON_LOOKBACK_DAYS` to customize (default: 3)

Check Vercel logs to confirm: https://vercel.com/dashboard/ice-erp/integrations?category=cron

## Configuration Reference

### Environment Variables

| Variable | Format | Purpose | Required |
|----------|--------|---------|----------|
| `BOG_CREDENTIALS_MAP` | JSON array | Multi-insider credentials | If not using legacy mode |
| `BOG_CLIENT_ID` | String | OAuth client ID (legacy) | If not using credentials map |
| `BOG_CLIENT_SECRET` | String | OAuth client secret (legacy) | If not using credentials map |
| `BOG_ACCESS_TOKEN` | String | Static token fallback | Only if no OAuth |
| `CRON_SECRET` | String | Authorization for cron job | ✓ Already set |
| `BOG_CRON_LOOKBACK_DAYS` | Number (default: 3) | Days to fetch each cron run | Optional |
| `BOG_CRON_INCLUDE_TODAY` | 0 or 1 | Include today in fetch range | Optional (default: 0) |

### API Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/cron/bog-import-last-3-days` | GET | Automatic daily import | Vercel cron header |
| `/api/cron/bog-import-backfill` | POST | Manual backfill by date range | Bearer token |

## Troubleshooting

### "BOG credentials not configured"
**Solution**: Check that one of these is set in Vercel:
- `BOG_CREDENTIALS_MAP` (preferred)
- `BOG_CLIENT_ID` + `BOG_CLIENT_SECRET`
- `BOG_ACCESS_TOKEN`

### "BOG API 401"
**Solution**: Credentials are invalid or expired. Update them in Vercel environment.

### "Unauthorized" error
**Solution**: Make sure `CRON_SECRET` is set correctly in `.env.local` for local testing.

### Cron job not triggering
**Solution**: Check Vercel project settings:
- Verify cron job is enabled
- Check `/api/cron/bog-import-last-3-days` exists
- Review Vercel logs for errors

## Next Steps

1. **Get BOG Credentials**: Contact BOG or use existing insider account credentials
2. **Set Environment Variables**: Add to Vercel dashboard
3. **Pull Latest Config**: Run `vercel env pull` locally
4. **Test Backfill**: Run `node _bog_backfill.js` to verify
5. **Monitor**: Check Vercel logs daily to confirm cron runs
6. **Verify Data**: Query `bank_accounts` table to see imported transactions

## Reference Files

- Cron job implementation: `app/api/cron/bog-import-last-3-days/route.ts`
- Backfill endpoint: `app/api/cron/bog-import-backfill/route.ts`
- Backfill script: `_bog_backfill.js`
- BOG client library: `lib/integrations/bog/client.ts`
- Processing logic: `lib/bank-import/import_bank_xml_data_deconsolidated.ts`
- More details: See AGENTS.md section "BOG GEL Bank Statement Processing"
