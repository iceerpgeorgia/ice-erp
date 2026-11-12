# Alliance Highline Recovery - Using Google Cloud Backup

**Status**: Ready to execute using provided GCP credentials  
**GCP Project ID**: 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97  
**Target**: Alliance Highline cost payment recovery  
**Estimated Time**: 20-30 minutes

---

## Overview

You have access to a Google Cloud backup containing the original Alliance Highline cost payment data (with payment_ids intact). This guide shows how to:

1. Connect to the GCP backup database
2. Query the original cost payment IDs
3. Export to CSV
4. Match against production orphaned records
5. Execute recovery on production

---

## Step 1: Access GCP Backup Database

### Using Google Cloud Console

1. Go to https://console.cloud.google.com
2. Select project: **375767513481-1av0rviq61cgvvll6khd68p8l7odlm97**
3. Navigate to **SQL** → **Instances**
4. Find the backup instance containing Alliance Highline data
5. Click to open connection details

### Using gcloud CLI

```bash
# Configure project
gcloud config set project 375767513481-1av0rviq61cgvvll6khd68p8l7odlm97

# List available Cloud SQL instances
gcloud sql instances list

# Get instance details
gcloud sql instances describe [INSTANCE_NAME]

# Connect to database
gcloud sql connect [INSTANCE_NAME] --user=postgres
```

### Using Cloud SQL Proxy (Recommended)

```bash
# Install Cloud SQL Proxy
# https://cloud.google.com/sql/docs/postgres/sql-proxy

# Download credentials JSON file from GCP Console
# → Cloud SQL Admin API → Service Accounts → Create/Download JSON key

# Start the proxy
cloud_sql_proxy -instances=375767513481:us-central1:[INSTANCE_NAME]=tcp:5432

# Connect via psql in another terminal
psql -h 127.0.0.1 -U postgres -d ice_erp
```

**Password**: `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` (if prompted)

---

## Step 2: Query Backup for Cost Payment IDs

Once connected to the backup database, execute:

```sql
-- Query: Get original cost payment IDs from backup
SELECT 
    p.id,
    p.uuid,
    p.counteragent_uuid,
    p.payment_id,
    p.amount,
    p.financial_code_uuid,
    p.waybill_derived,
    p.created_at,
    p.updated_at
FROM payments p
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NOT NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
```

**Expected Result**: 20 rows with payment_id values populated

---

## Step 3: Export to CSV

### Option A: Using psql COPY Command

```bash
psql -h 127.0.0.1 -U postgres -d ice_erp << 'EOF' > alliance_cost_payments_backup.csv
\copy (SELECT id, uuid, counteragent_uuid, payment_id, amount, financial_code_uuid, waybill_derived, created_at, updated_at FROM payments WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262' AND waybill_derived = TRUE AND payment_id IS NOT NULL ORDER BY financial_code_uuid, counteragent_uuid, id) TO STDOUT WITH CSV HEADER;
EOF
```

### Option B: Using GCP Cloud Console

1. Go to SQL Editor in Cloud Console
2. Paste the query from Step 2
3. Click **Run**
4. Click **Download as CSV**
5. Save as `alliance_cost_payments_backup.csv`

### Verify CSV

```bash
# Check file exists and has data
ls -lh alliance_cost_payments_backup.csv
wc -l alliance_cost_payments_backup.csv
head -5 alliance_cost_payments_backup.csv

# Expected: 21 lines (1 header + 20 data rows)
```

---

## Step 4: Query Production for Orphaned Records

Connect to **production** Supabase (NOT the GCP backup):

```bash
# Using Supabase SQL Editor
# 1. Go to https://supabase.com
# 2. Select ice-erp project
# 3. Click "SQL Editor" → "New Query"
# 4. Paste this query:
```

```sql
-- Query: Get orphaned cost payments in production
SELECT 
    p.id,
    p.uuid,
    p.counteragent_uuid,
    p.amount,
    p.financial_code_uuid,
    p.waybill_derived,
    p.created_at,
    p.updated_at
FROM payments p
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
```

**Expected Result**: 20 rows with payment_id = NULL

### Export Production to CSV

1. Click **Download as CSV**
2. Save as `alliance_orphaned_payments_prod.csv`

---

## Step 5: Match Backup Against Production

You now have two CSVs:
- `alliance_cost_payments_backup.csv` - Original data with payment_ids
- `alliance_orphaned_payments_prod.csv` - Orphaned records needing recovery

### Run Matching Script

```bash
# Place both CSV files in project root
ls -la alliance_cost_payments_backup.csv
ls -la alliance_orphaned_payments_prod.csv

# Run the matching script
npx ts-node scripts/alliance-recovery-backup-match.ts
```

**Output**:
```
🔄 Alliance Highline Cost Payment Recovery - Backup Matching

📂 Loading backup data from: alliance_cost_payments_backup.csv
   ✅ Loaded 20 records from backup

📂 Loading orphaned data from: alliance_orphaned_payments_prod.csv
   ✅ Loaded 20 records from production

🔍 Matching payments by composite key...

✅ Generated recovery mapping:
   Matched: 20 payments
   Unmatched: 0 payments

💾 Saved 20 UPDATE statements to: alliance-recovery-statements.sql
📋 Saved transaction wrapper to: alliance-recovery-transaction.sql

📊 RECOVERY SUMMARY
══════════════════════════════════════════════════════
Backup Records:     20
Orphaned Records:   20
Matched:            20
Unmatched:          0
Expected:           20
══════════════════════════════════════════════════════

✅ Recovery mapping is COMPLETE and READY to execute
```

---

## Step 6: Review Generated SQL

The script creates two files:

### alliance-recovery-statements.sql
Contains 20 UPDATE statements:
```sql
UPDATE payments SET payment_id = '1f42f3_6f_b98fac' WHERE uuid = '...';
UPDATE payments SET payment_id = '1f42f3_6f_b98fac' WHERE uuid = '...';
-- ... 20 total
```

### alliance-recovery-transaction.sql
Full transaction with verification:
```sql
BEGIN;

CREATE TEMP TABLE recovery_starting_state AS
SELECT uuid, payment_id FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NULL;

-- All 20 UPDATE statements here

SELECT 'Final state:' as info,
    SUM(CASE WHEN payment_id IS NOT NULL THEN 1 ELSE 0 END) as with_ids
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE;

-- COMMIT; or ROLLBACK;
```

### Review the SQL

```bash
# Check number of UPDATE statements
grep "^UPDATE" alliance-recovery-statements.sql | wc -l
# Should be: 20

# Preview first few statements
head -3 alliance-recovery-statements.sql

# Review full transaction
cat alliance-recovery-transaction.sql
```

---

## Step 7: Execute Recovery on Production

### Using Supabase SQL Editor (Recommended)

1. Go to https://supabase.com → Select ice-erp project
2. Click **SQL Editor** → **New Query**
3. Open `alliance-recovery-transaction.sql` in your editor
4. Copy the entire content
5. Paste into Supabase SQL Editor
6. Click **Run**

### Expected Output

```
Starting state: count(*) = 20

Recovery results:
payments_with_ids: 20
total_with_ids: 20

Final state:
with_ids: 20
without_ids: 0
```

**Success**: All values show 20 (all orphaned payments recovered)

### Using psql

```bash
psql postgresql://[user]:[password]@[host]/postgres < alliance-recovery-transaction.sql
```

---

## Step 8: Verify in Production UI

### Check Database

```sql
-- Verify all 20 have payment_id
SELECT COUNT(*) as with_payment_id
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NOT NULL;

-- Should return: 20

-- Verify no orphaned records remain
SELECT COUNT(*) as orphaned
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NULL;

-- Should return: 0
```

### Test in Web UI

1. Open https://ice-erp.vercel.app
2. Login and navigate to **Alliance Highline** project
3. Go to **Dictionaries** → **Payments Report**
4. Filter: Type = Cost
5. **✅ All rows should have payment_id values** (no blank cells)
6. Go to **Handovers** page
7. Select Alliance Highline project
8. **✅ Job Distributions should render** (was broken before)
9. Check **Payments** and allocations

---

## Troubleshooting

### GCP Connection Failed

**Error**: `Connection refused` or `Authentication failed`

**Solution**:
1. Verify project ID: `375767513481-1av0rviq61cgvvll6khd68p8l7odlm97`
2. Check password: `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`
3. Verify Cloud SQL instance is running
4. Check firewall rules allow your IP
5. Use Cloud SQL Proxy instead of direct connection

### CSV Mismatch

**Error**: Script shows `Unmatched: X` records

**Possible Causes**:
- CSV files have different row counts
- Order doesn't match (check ORDER BY in queries)
- Missing data in backup

**Solution**:
1. Recount rows: `wc -l *.csv`
2. Check backup query included `ORDER BY financial_code_uuid, counteragent_uuid`
3. Verify both queries used same filters
4. Re-export with exact SQL provided

### SQL Execution Failed

**Error**: `INSERT/UPDATE/DELETE failed`

**Solution**:
1. Check no duplicate UUIDs
2. Verify column names match current schema
3. Run simpler test first: `SELECT COUNT(*) FROM payments;`
4. Check database is not in read-only mode
5. Review error message for constraint violations

### Recovery Shows Wrong Count

**After execution, count is not 20**

**Solution**:
1. Run verification query from Step 8
2. Check if partial update occurred (some succeeded, some failed)
3. Review Supabase logs for errors
4. Consider rollback and retry with reduced batch size

---

## Timeline

| Step | Task | Time |
|------|------|------|
| 1 | Access GCP backup | 5 min |
| 2 | Query backup | 1 min |
| 3 | Export to CSV | 2 min |
| 4 | Query production | 1 min |
| 5 | Export production CSV | 2 min |
| 6 | Match CSVs | 2 min |
| 7 | Execute recovery SQL | 1 min |
| 8 | Verify in UI | 5 min |
| **Total** | **Complete recovery** | **~20 minutes** |

---

## Files Generated

| File | Purpose |
|------|---------|
| `alliance_cost_payments_backup.csv` | Original data from GCP backup |
| `alliance_orphaned_payments_prod.csv` | Orphaned records from production |
| `alliance-recovery-statements.sql` | 20 UPDATE statements |
| `alliance-recovery-transaction.sql` | Full transaction with verification |

---

## Success Criteria

Recovery is complete when:
- ✅ CSV matching shows 20 matched, 0 unmatched
- ✅ SQL execution shows 20 rows updated
- ✅ Verification query returns 20 with_ids, 0 orphaned
- ✅ Payments Report shows all cost entries with payment_id
- ✅ Job Distributions page renders without errors
- ✅ Handovers page calculates correctly

---

## Next Actions

1. **Connect to GCP**: Use provided credentials to access backup
2. **Export both datasets**: Backup original data + production orphaned
3. **Run matching script**: Generate recovery SQL
4. **Execute recovery**: Run on production Supabase
5. **Verify**: Check UI and database state

**Ready to proceed?** Start with Step 1: Access GCP Backup Database
