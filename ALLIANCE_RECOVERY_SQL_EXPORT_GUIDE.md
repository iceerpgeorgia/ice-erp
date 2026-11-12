# Alliance Highline Recovery - SQL Export Guide

**Goal**: Export orphaned cost payment records from production Supabase so we can analyze and recover them.

**Project**: Alliance Highline (dc975886-9bf9-42c8-afbe-87695aa01262)  
**Expected Records**: 20 cost payments with `payment_id = NULL`

---

## Quick Start: 5 Minutes

### Step 1: Open Supabase SQL Editor
1. Go to: https://app.supabase.com/
2. Select project: **ice-erp** (fojbzghphznbslqwurrm)
3. Click: **SQL Editor** (left sidebar)
4. Click: **New Query** (top right)

### Step 2: Export Orphaned Cost Payments
1. Open file: `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql`
2. Copy **QUERY 1** (lines 26-50)
3. Paste into Supabase SQL Editor
4. Click: **RUN** button
5. Wait for results (should show **20 rows**)
6. Click: **Download CSV** button (bottom right)
7. Save as: **`alliance_orphaned_payments_prod.csv`**

✅ Done! You now have the orphaned records.

---

## Full SQL Export Instructions

### QUERY 1: Orphaned Cost Payments (20 rows) ⭐ START HERE
**What it shows**: All cost payments with `payment_id = NULL` (these need recovery)

```sql
SELECT 
    p.id, p.uuid, p.payment_id, p.project_uuid, p.counteragent_uuid,
    p.financial_code_uuid, p.currency_uuid, p.amount, p.waybill_derived,
    fc.code as financial_code, ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
    AND p.payment_id IS NULL
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    p.created_at;
```

**Expected Output**: 20 rows  
**File**: `alliance_orphaned_payments_prod.csv`

---

### QUERY 2: All Cost Payments (reference)
**What it shows**: All cost payments (for verification)

```sql
SELECT 
    p.id, p.uuid, p.payment_id, p.project_uuid, p.counteragent_uuid,
    p.financial_code_uuid, p.currency_uuid, p.amount, p.waybill_derived,
    fc.code as financial_code, ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = TRUE
ORDER BY 
    p.financial_code_uuid,
    p.counteragent_uuid,
    p.created_at;
```

**Expected Output**: 20 rows  
**Purpose**: Verify all cost payments are orphaned

---

### QUERY 3: Income Payments (verification)
**What it shows**: Income payments (should all have `payment_id = NULL` as intended)

```sql
SELECT 
    p.id, p.uuid, p.payment_id, p.project_uuid, p.counteragent_uuid,
    p.financial_code_uuid, fc.code as financial_code, ca.name as counteragent_name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.uuid
WHERE 
    p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND p.waybill_derived = FALSE
ORDER BY 
    p.counteragent_uuid,
    p.created_at;
```

**Expected Output**: 71 rows  
**Note**: If more than 100 rows, download in batches using LIMIT/OFFSET

---

### QUERY 4: Waybill Source Data (reference)
**What it shows**: Waybills that should correspond to cost payments

```sql
SELECT 
    w.id, w.uuid, w.rs_id, w.waybill_no, w.project_uuid,
    w.counteragent_uuid, w.financial_code_uuid, w.sum,
    fc.code as financial_code, ca.name as counteragent_name
FROM rs_waybills_in_api w
LEFT JOIN financial_codes fc ON w.financial_code_uuid = fc.uuid
LEFT JOIN counteragents ca ON w.counteragent_uuid = ca.uuid
WHERE 
    w.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
ORDER BY 
    w.created_at DESC;
```

**Expected Output**: 20-40 rows  
**Purpose**: See source waybill data

---

## Understanding the Data

### Key Columns

| Column | Meaning |
|--------|---------|
| `payment_id` | **NULL for orphaned rows** — this is what we're recovering |
| `waybill_derived` | TRUE = cost payment, FALSE = income payment |
| `financial_code_uuid` | Grouping key for matching |
| `counteragent_uuid` | Grouping key for matching |
| `counteragent_name` | Which company/counteragent (for human reading) |
| `amount` | Payment amount in account currency |

### Grouping for Recovery

The recovery algorithm groups by:
1. **financial_code_uuid** (which type of financial code)
2. **counteragent_uuid** (which counteragent)

Within each group, payments are matched by their ordinal position (first to first, second to second, etc.).

---

## CSV Export Workflow

### Step-by-Step

1. **Copy QUERY 1** from `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql`
2. **Paste** into Supabase SQL Editor
3. **Click RUN** to execute
4. **Wait** for results (5-10 seconds)
5. **Click Download CSV** (blue button, bottom right)
6. **Save** as `alliance_orphaned_payments_prod.csv`

### If Query Returns 0 Rows

Problem: No orphaned cost payments found.

**Check**:
- Are you looking at production Supabase (fojbzghphznbslqwurrm)?
- Is the Project UUID correct? (`dc975886-9bf9-42c8-afbe-87695aa01262`)
- Run QUERY 2 to verify cost payments exist at all
- Run QUERY 3 to verify income payments are orphaned

### If Query Returns >100 Rows

Problem: Supabase CSV export limit is 100 rows.

**Solution**: Add LIMIT/OFFSET to query

```sql
... WHERE project_uuid = '...' AND waybill_derived = FALSE
ORDER BY ...
LIMIT 100 OFFSET 0;        -- First 100
```

Then repeat with `OFFSET 100`, `OFFSET 200`, etc.

---

## After Export

1. **Save CSV** as `alliance_orphaned_payments_prod.csv`
2. **Next step**: Use matching script
   - `scripts/alliance-recovery-backup-match.ts`
3. **Script will**:
   - Load your CSV
   - Group by (financial_code_uuid, counteragent_uuid)
   - Generate recovery SQL
4. **Execute** generated SQL in Supabase
5. **Verify** payment_ids are restored

---

## Files Referenced

- **Queries**: `ALLIANCE_RECOVERY_EXPORT_QUERIES.sql` (this directory)
- **Matching script**: `scripts/alliance-recovery-backup-match.ts`
- **Recovery guide**: `ALLIANCE_RECOVERY_BACKUP_RECOVERY_GUIDE.md`

---

## Questions?

- **Can't find SQL Editor?** → Settings → SQL Editor (Supabase Dashboard)
- **Which project?** → "ice-erp" (fojbzghphznbslqwurrm.supabase.co)
- **No CSV download button?** → Scroll right in results, should see blue button
- **Query errors?** → Check Project UUID is exactly: `dc975886-9bf9-42c8-afbe-87695aa01262`

---

**Ready to export? Open Supabase Dashboard and run QUERY 1!** 🚀
