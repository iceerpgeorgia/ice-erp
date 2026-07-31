# 🚀 Resume BOG Cron Job - Action Checklist

**Status**: Bank transaction cron is BLOCKED due to missing BOG credentials.  
**Action Required**: Populate `BOG_CREDENTIALS_MAP` in Vercel environment.

---

## ✅ Step-by-Step Recovery Plan

### Step 1: Gather BOG Credentials (5 min)

You need **one of these credential sets**:

#### Option A: Multi-Insider (if you have multiple BOG insiders)
```
Insider UUID: __________________
Access Token: __________________  (OR use Option B below)
```

#### Option B: OAuth Credentials (standard approach)
```
Client ID:     __________________
Client Secret: __________________
```

#### Option C: Static Token (if available)
```
Access Token: __________________
```

**Where to find these**:
- Contact your BOG account manager or ICE system administrator
- Check ICE team's internal credentials store
- Verify with whoever set up initial BOG integration

---

### Step 2: Update Vercel Environment Variables (2 min)

**Go to**: https://vercel.com/dashboard/ice-erp/settings/environment-variables

**Add ONE of these sets**:

#### If using OAuth credentials (RECOMMENDED):
```
BOG_CLIENT_ID = [your-client-id]
BOG_CLIENT_SECRET = [your-client-secret]
```
✓ Apply to: Production  
✓ Click "Save"

#### If using Multi-Insider Map:
```
BOG_CREDENTIALS_MAP = [{"insiderUuid":"uuid-here","clientId":"id","clientSecret":"secret"}]
```
✓ Apply to: Production  
✓ Click "Save"

---

### Step 3: Verify Credentials Locally (2 min)

```bash
# Pull latest environment from Vercel
vercel env pull

# Run config check
node _bog_backfill.js
```

**Expected output**:
```
✓ CRON_SECRET: ✓ SET
✓ BOG_CREDENTIALS_MAP: ✓ SET (XX chars)    OR
✓ BOG_CLIENT_ID: ✓ SET
✓ BOG_ACCESS_TOKEN: ✓ SET
```

**If still failing**: Verify credentials are correct and production environment is set.

---

### Step 4: Backfill Last 30 Days (10 min)

Once credentials verified, import missing transactions:

```bash
# Option 1: Last 30 days (default)
node _bog_backfill.js

# Option 2: Last 60 days
node _bog_backfill.js 60

# Option 3: Custom date range
node _bog_backfill.js --start 2026-06-01 --end 2026-07-31
```

**What to expect**:
```
✅ SUCCESS
   Total transactions imported: 1,234
   Successful days: 30
   Failed days: 0
   Period: 2026-06-08 → 2026-07-08
```

---

### Step 5: Verify Daily Cron Continues (Automatic)

The cron job will now automatically run daily at **3 AM UTC (7 AM Tbilisi)**.

**How to verify**:
1. Go to: https://vercel.com/dashboard/ice-erp/crons
2. Look for `/api/cron/bog-import-last-3-days`
3. Check status = "✓ Passed"
4. Review logs for any errors

---

## 📋 Quick Command Reference

| Task | Command |
|------|---------|
| Check config status | `node _bog_backfill.js` |
| Backfill last 30 days | `node _bog_backfill.js` |
| Backfill custom range | `node _bog_backfill.js --start YYYY-MM-DD --end YYYY-MM-DD` |
| Pull Vercel env | `vercel env pull` |
| View cron logs | Visit Vercel dashboard → Crons |
| Check recent imports | Query: `SELECT MAX(transaction_date) FROM "GE78BG0000000893486000_BOG_USD"` |

---

## 🔍 Verification Queries

After backfill completes, run these to verify:

```sql
-- Check transaction count by date
SELECT transaction_date, COUNT(*) as count
FROM "GE78BG0000000893486000_BOG_USD"
WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY transaction_date
ORDER BY transaction_date DESC;

-- Check most recent import
SELECT MAX(created_at) as last_import, COUNT(*) as total_count
FROM "GE78BG0000000893486000_BOG_USD";

-- Verify all accounts have data
SELECT 
  CASE 
    WHEN debit_amount IS NOT NULL THEN 'Debit'
    ELSE 'Credit'
  END as flow,
  COUNT(*) as count,
  ROUND(AVG(COALESCE(debit_amount, credit_amount))::numeric, 2) as avg_amount
FROM "GE78BG0000000893486000_BOG_USD"
WHERE transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY flow;
```

---

## ⚠️ Troubleshooting

| Error | Solution |
|-------|----------|
| "BOG credentials not configured" | Check Vercel env variables are set to Production |
| "401 Unauthorized" | Verify Client ID/Secret are correct and haven't expired |
| "Can't connect to BOG API" | Check internet connection, BOG API might be down |
| Backfill shows 0 transactions | Some days may have no activity - this is normal |
| Cron log shows errors | Review Vercel dashboard → Crons tab for error details |

---

## 🎯 Success Criteria

✅ All of these should be true:

- [ ] `BOG_CREDENTIALS_MAP` or `BOG_CLIENT_ID`/`BOG_CLIENT_SECRET` set in Vercel
- [ ] `node _bog_backfill.js` runs without "credentials not configured" error
- [ ] Backfill shows "✅ SUCCESS" with transaction count > 0
- [ ] Recent bank transactions visible in raw tables (e.g., GE78BG...BOG_USD)
- [ ] Next scheduled cron (3 AM UTC tomorrow) completes successfully
- [ ] Vercel dashboard shows "✓ Passed" for `/api/cron/bog-import-last-3-days`

---

## 📞 Support

If you're stuck on any step:

1. **For credentials**: Contact your BOG account manager
2. **For environment setup**: Check Vercel docs on environment variables
3. **For code issues**: Review `app/api/cron/bog-import-last-3-days/route.ts` and `BOG_CRON_SETUP.md`
4. **For bank data**: Query raw tables like `GE78BG0000000893486000_BOG_USD`

---

## 📝 Notes

- Backfill is safe to run multiple times (deduplication by operation_id)
- Cron job runs automatically after credentials configured
- Custom lookback can be set via `BOG_CRON_LOOKBACK_DAYS` environment variable
- Both cron and backfill use identical processing logic (XML → deconsolidation)
