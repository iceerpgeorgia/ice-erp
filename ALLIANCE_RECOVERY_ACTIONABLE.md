# Alliance Highline Recovery - SQL Export & Analysis (ACTIONABLE)

**Status**: Ready for immediate execution  
**Time to data recovery**: 30 minutes

---

## What You Need to Do

### Step 1: Export Orphaned Cost Payments (5 minutes)

**Open**: https://app.supabase.com/projects/fojbzghphznbslqwurrm/sql/new

**Copy & Run** this SQL query:

```sql
SELECT 
    p.uuid,
    p.payment_id,
    p.counteragent_uuid,
    p.financial_code_uuid,
    p.amount,
    p.created_at,
    ca.name as counteragent_name,
    fc.code as financial_code
FROM payments p
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
    AND p.payment_id IS NULL
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    p.created_at;
```

**Expected**: 20 rows (the orphaned cost payments)

**Download**: Click "Download CSV" button → Save as `alliance_orphaned_payments.csv`

---

### Step 2: Export Waybill Source Data (3 minutes)

**Why**: To verify the relationship between waybills and cost payments

**Copy & Run** this SQL query:

```sql
SELECT 
    w.uuid,
    w.waybill_no,
    w.rs_id,
    w.counteragent_uuid,
    w.financial_code_uuid,
    w.sum,
    w.create_date,
    ca.name as counteragent_name,
    fc.code as financial_code
FROM rs_waybills_in_api w
LEFT JOIN counteragents ca ON w.counteragent_uuid = ca.uuid
LEFT JOIN financial_codes fc ON w.financial_code_uuid = fc.uuid
WHERE 
    w.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
ORDER BY 
    w.created_at DESC;
```

**Expected**: 20-40 rows

**Download**: Click "Download CSV" button → Save as `alliance_waybills.csv`

---

## What These Files Contain

### `alliance_orphaned_payments.csv`

The 20 cost payments that need recovery:

| uuid | payment_id | counteragent_uuid | financial_code_uuid | counteragent_name | financial_code |
|------|------------|-------------------|----------------------|-------------------|-----------------|
| xxxx-xxxx-... | **NULL** | cccc-... | ffff-... | Alliance Highline | 3.9.1 |
| ... | ... | ... | ... | ... | ... |

**Key insight**: `payment_id` column is empty (NULL) — this is what we're recovering

### `alliance_waybills.csv`

The source waybills that generated the cost payments:

| uuid | waybill_no | counteragent_uuid | financial_code_uuid | sum | counteragent_name |
|------|------------|-------------------|----------------------|-----|-------------------|
| yyyy-yyyy-... | WB-123 | cccc-... | ffff-... | 10000 | Alliance Highline |
| ... | ... | ... | ... | ... | ... |

---

## Recovery Algorithm

Once you have the CSVs, the matching algorithm works like this:

### Grouping
1. Group cost payments by `(financial_code_uuid, counteragent_uuid)`
2. Group waybills by `(financial_code_uuid, counteragent_uuid)`

### Matching
Within each group:
- 1st cost payment matches 1st waybill
- 2nd cost payment matches 2nd waybill
- etc.

### Result
Generate recovery SQL that updates each orphaned cost payment with the matching waybill's payment_id.

---

## Next Steps After Export

### Option A: Manual Recovery (Recommended for verification)

1. **Analyze the CSVs**:
   - Open `alliance_orphaned_payments.csv` in Excel/Google Sheets
   - Open `alliance_waybills.csv` in Excel/Google Sheets
   - Verify grouping by (counteragent_uuid, financial_code_uuid)
   - Check position matching makes sense

2. **Run matching script**:
   ```bash
   npx ts-node scripts/alliance-recovery-backup-match.ts \
     --orphaned alliance_orphaned_payments.csv \
     --waybills alliance_waybills.csv \
     --output alliance_recovery.sql
   ```

3. **Review generated SQL**:
   - Open `alliance_recovery.sql`
   - Verify all 20 UPDATE statements look correct

4. **Execute recovery**:
   - Copy all UPDATE statements
   - Paste into Supabase SQL Editor
   - Run to restore payment_ids

### Option B: Direct API Recovery (Fastest - 30 seconds)

If you prefer automated deterministic matching:

```bash
export CRON_SECRET="pA0josnPQ0Qnee6B47f7ATN/GN60cNfxU3SXJKZwSQA="

curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze"}'

# If analysis looks good:
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"recover","confirm":true}'
```

---

## Verification After Recovery

After you restore the payment_ids, verify:

### In Supabase SQL Editor:

```sql
-- Should show 20 rows with payment_id populated (not NULL)
SELECT COUNT(*) as orphaned_cost_payments
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NULL;

-- Should return 0 if recovery successful
```

### In Application UI:

1. **Payments → Report**
   - Filter: Alliance Highline project
   - Check: 20 cost payment rows show payment_id (not "Unknown")

2. **Handovers → Job Distributions**
   - Select: Alliance Highline project
   - Check: Distributions resolve correctly to bank transactions

3. **Handovers Page**
   - Check: Job allocation grid displays properly

---

## SQL Export Detailed Queries

For reference, all detailed queries are in: `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql`

Contains:
- Query 1: Orphaned cost payments (20 rows) ⭐
- Query 2: All cost payments (reference)
- Query 3: Income payments (verification)
- Query 4: Waybill source data
- Query 5: Payment ledger entries

---

## Summary

| Step | Action | Time | Output |
|------|--------|------|--------|
| 1 | Export orphaned cost payments | 5 min | `alliance_orphaned_payments.csv` |
| 2 | Export waybill data | 3 min | `alliance_waybills.csv` |
| 3 | Analyze grouping/matching | 5 min | CSV review |
| 4 | Generate recovery SQL | 2 min | `alliance_recovery.sql` |
| 5 | Execute recovery | 2 min | 20 rows updated |
| 6 | Verify in UI | 5 min | Confirmation |
| **Total** | | **22 minutes** | **Full recovery** |

---

## Files You Have

- ✅ `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql` — All SQL queries
- ✅ `ALLIANCE_RECOVERY_SQL_EXPORT_GUIDE.md` — Detailed export instructions
- ✅ `scripts/alliance-recovery-backup-match.ts` — Matching script
- ✅ `app/api/admin/alliance-recovery/route.ts` — API recovery endpoint (optional)

---

## Start Now

1. Go to: https://app.supabase.com/projects/fojbzghphznbslqwurrm/sql/new
2. Copy the first SQL query (above)
3. Paste & Run
4. Download CSV
5. Done with Step 1!

Then proceed to Step 2.

**Total time to full recovery: 30 minutes** ⏱️
