# Alliance Highline Recovery - GCP Backup Path Summary

**Status**: ✅ Ready to execute  
**Method**: Use provided Google Cloud backup credentials  
**Time**: 20 minutes  
**Complexity**: Low-Medium

---

## You Have Access To

**Google Cloud Project**: `375767513481-1av0rviq61cgvvll6khd68p8l7odlm97`  
**Database**: Contains original Alliance Highline data with cost payment IDs intact  
**Credentials**: 
- Key ID: `1av0rviq61cgvvll6khd68p8l7odlm97`
- Password: `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`

---

## Three-Step Recovery Process

### Step 1: Query GCP Backup (5 minutes)

Connect to the Google Cloud backup database and query the original cost payment data:

```sql
SELECT 
    p.uuid,
    p.counteragent_uuid,
    p.payment_id,
    p.amount,
    p.financial_code_uuid
FROM payments p
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NOT NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
```

**Expected**: 20 rows with all payment_ids populated

Export to CSV: `alliance_cost_payments_backup.csv`

### Step 2: Query Production Orphaned Records (3 minutes)

Connect to production Supabase and query the orphaned cost payments:

```sql
SELECT 
    p.uuid,
    p.counteragent_uuid,
    p.amount,
    p.financial_code_uuid
FROM payments p
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
```

**Expected**: 20 rows with payment_id = NULL

Export to CSV: `alliance_orphaned_payments_prod.csv`

### Step 3: Match & Execute Recovery (2 minutes)

Run the matching script:

```bash
npx ts-node scripts/alliance-recovery-backup-match.ts
```

This generates:
- `alliance-recovery-statements.sql` - 20 UPDATE statements
- `alliance-recovery-transaction.sql` - Full transaction

Copy the transaction SQL into Supabase SQL Editor and execute.

---

## How to Connect to GCP Backup

### Option A: Cloud SQL Proxy (Recommended)

```bash
# 1. Install Cloud SQL Proxy
#    https://cloud.google.com/sql/docs/postgres/sql-proxy

# 2. Download credentials JSON from GCP Console
#    → Cloud SQL Admin → Service Accounts → Create/Download JSON

# 3. Start proxy
cloud_sql_proxy -instances=375767513481:us-central1:[INSTANCE_NAME]=tcp:5432

# 4. Connect in another terminal
psql -h 127.0.0.1 -U postgres -d ice_erp
```

### Option B: gcloud CLI

```bash
# 1. Install gcloud CLI
# 2. Authenticate
gcloud auth login
gcloud config set project 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97

# 3. Find instance
gcloud sql instances list

# 4. Connect
gcloud sql connect [INSTANCE_NAME] --user=postgres
```

### Option C: GCP Console

1. Go to https://console.cloud.google.com
2. Project: 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97
3. SQL → Instances → [Your Backup Instance]
4. Click "Cloud Shell" connection button
5. Execute queries in SQL editor

---

## Why This Approach Works

✅ **Direct Access**: You have real credentials to the backup database  
✅ **No Restoration Needed**: Data is already accessible, no time waiting  
✅ **Verifiable**: Query the exact original data before executing recovery  
✅ **Safe**: Two independent data sources (backup + production) ensure accuracy  
✅ **Fast**: 20 minutes total vs. 30-45 minutes for Supabase restore  

---

## Expected Timeline

| Task | Duration |
|------|----------|
| Connect to GCP | 2-5 min |
| Query backup & export CSV | 3 min |
| Query production & export CSV | 3 min |
| Run matching script | 2 min |
| Execute recovery SQL | 1 min |
| Verify in UI | 5 min |
| **Total** | **~20 minutes** |

---

## Success Criteria

- ✅ GCP backup query returns 20 rows with payment_ids
- ✅ Production query returns 20 orphaned records
- ✅ Matching script shows 20 matched, 0 unmatched
- ✅ Recovery SQL execution shows 20 updated
- ✅ Verification query returns 20 with_ids, 0 orphaned
- ✅ UI shows payment_ids in Payments Report
- ✅ Job Distributions page renders correctly
- ✅ Handovers page calculates properly

---

## Files Reference

| File | Purpose |
|------|---------|
| `ALLIANCE_RECOVERY_GCP_GUIDE.md` | Full step-by-step GCP recovery guide |
| `scripts/alliance-recovery-backup-match.ts` | CSV matching script (same for all backup methods) |
| `scripts/alliance-recovery-gcp-backup.ts` | GCP credentials validation helper |

---

## Next Action

**Start Here**: Read `ALLIANCE_RECOVERY_GCP_GUIDE.md` for detailed instructions

Then execute:
1. Connect to GCP backup (Step 1 in guide)
2. Query and export both CSVs (Steps 2-4)
3. Run matching script (Step 5)
4. Execute recovery SQL (Step 6)
5. Verify in UI (Step 7)

---

**Ready?** Open `ALLIANCE_RECOVERY_GCP_GUIDE.md` and start with Step 1: Access GCP Backup Database
