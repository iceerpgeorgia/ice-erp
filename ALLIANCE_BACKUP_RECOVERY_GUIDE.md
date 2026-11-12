# Alliance Highline Cost Payment Recovery - Supabase Backup Method

This guide uses a Supabase point-in-time backup restore to recover the deleted cost payment IDs without affecting production.

## Overview

**Goal**: Restore cost payment IDs from backup without touching production until ready

**Method**: 
1. Restore latest Supabase backup to temporary project
2. Query backup for original cost payment ID assignments
3. Compare with production orphaned records
4. Bulk update production with recovered IDs
5. Delete temporary backup project

**Project Details**
- **Name**: Alliance Highline | 1.1.1 | ალიანსი თბილისი
- **Project UUID**: `dc975886-9bf9-42c8-afbe-87695aa01262`
- **Affected Records**: 20 cost payments with missing payment_ids
- **Currency**: USD
- **Value**: 2,281,058.00

## Step 1: Restore Supabase Backup

### 1.1 Access Supabase Console
1. Go to https://supabase.com
2. Login with your credentials
3. Select the **ice-erp** project

### 1.2 Find & Restore Backup

1. Click **Settings** (bottom left gear icon)
2. Select **Backups** from left menu
3. Look for backups from **before the deletion** (check creation timestamps)
4. Click **Restore** on the appropriate backup
5. Choose **Restore to new project**
   - Name it something like: `ice-erp-alliance-recovery-backup-[DATE]`
   - This creates a separate database copy
   - Your production database remains untouched

### 1.3 Wait for Restore
- Backup restore typically takes **5-15 minutes**
- You'll receive email notification when complete
- Do NOT proceed until the new project shows "Active"

## Step 2: Get Backup Connection Details

Once the backup project is ready:

1. Click the **new backup project** name
2. Click **Settings** > **Database**
3. Copy the connection string:
   ```
   postgresql://postgres:[password]@[host]:[port]/postgres
   ```
4. Note:
   - Password is auto-generated in the restore confirmation email
   - Keep this secure (temporary use only)

## Step 3: Query the Backup for Cost Payment IDs

### 3.1 Create SQL Query File

Create a file `alliance-backup-query.sql`:

```sql
-- Query cost payments from backup
-- This shows the original payment_ids before they were deleted

SELECT 
    p.id,
    p.uuid,
    p.project_uuid,
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

### 3.2 Run Query Against Backup

Using `psql` (PostgreSQL client):

```bash
# Set backup connection string
export BACKUP_DB_URL="postgresql://postgres:[password]@[host]:[port]/postgres"

# Run query and export to CSV
psql "$BACKUP_DB_URL" -t -A -F',' << 'EOF' > alliance_cost_payments_backup.csv
SELECT 
    p.id,
    p.uuid,
    p.project_uuid,
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
EOF

# Show results
cat alliance_cost_payments_backup.csv
```

**Expected Output**: CSV with payment records and their original payment_ids

### 3.3 Alternative: Use Supabase Dashboard

If you prefer not to use `psql`:

1. Go to backup project in Supabase console
2. Click **SQL Editor** (left menu)
3. Click **New Query**
4. Paste the SQL query above
5. Click **Run**
6. Click **Download as CSV**

## Step 4: Query Production for Orphaned Records

### 4.1 Get Current Production State

Run against **production** database:

```sql
-- Find orphaned cost payments in production
SELECT 
    p.id,
    p.uuid,
    p.project_uuid,
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
  AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
```

**Expected**: 20 records with `payment_id = NULL`

### 4.2 Extract to CSV

```bash
# Set production connection string
export PROD_DB_URL="postgresql://postgres:[password]@[host]:[port]/postgres"

# Get orphaned records
psql "$PROD_DB_URL" -t -A -F',' << 'EOF' > alliance_orphaned_payments_prod.csv
SELECT 
    p.id,
    p.uuid,
    p.counteragent_uuid,
    p.amount,
    p.financial_code_uuid,
    p.created_at
FROM payments p
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
  AND p.payment_id IS NULL
ORDER BY p.financial_code_uuid, p.counteragent_uuid, p.id;
EOF

cat alliance_orphaned_payments_prod.csv
```

## Step 5: Match & Prepare Recovery Data

### 5.1 Analyze Both Datasets

The backup shows the original payment_ids. The orphaned records show what needs fixing.

Match them by:
- **Composite Key**: `(financial_code_uuid, counteragent_uuid)`
- **Position**: Within each composite key group, use ROW_NUMBER() to match by position
- **Validation**: Check amounts match or are close (within reasonable tolerance)

### 5.2 Create Recovery Mapping

Create TypeScript script `build-alliance-recovery-mapping.ts`:

```typescript
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';

interface PaymentRecord {
  id: string;
  uuid: string;
  counteragent_uuid: string;
  payment_id?: string;
  amount: string;
  financial_code_uuid: string;
  created_at: string;
}

const backupData = csv.parse(
  fs.readFileSync('alliance_cost_payments_backup.csv', 'utf-8'),
  { columns: true }
) as PaymentRecord[];

const orphanedData = csv.parse(
  fs.readFileSync('alliance_orphaned_payments_prod.csv', 'utf-8'),
  { columns: true }
) as PaymentRecord[];

// Group by composite key
const backupByKey = new Map<string, PaymentRecord[]>();
const orphanedByKey = new Map<string, PaymentRecord[]>();

backupData.forEach(r => {
  const key = `${r.financial_code_uuid}|${r.counteragent_uuid}`;
  if (!backupByKey.has(key)) backupByKey.set(key, []);
  backupByKey.get(key)!.push(r);
});

orphanedData.forEach(r => {
  const key = `${r.financial_code_uuid}|${r.counteragent_uuid}`;
  if (!orphanedByKey.has(key)) orphanedByKey.set(key, []);
  orphanedByKey.get(key)!.push(r);
});

// Build recovery mapping
const recoverySQL: string[] = [];
let matchedCount = 0;

for (const [key, orphanedRecords] of orphanedByKey.entries()) {
  const backupRecords = backupByKey.get(key) || [];
  
  if (backupRecords.length !== orphanedRecords.length) {
    console.warn(`⚠️  Key mismatch for ${key}: backup has ${backupRecords.length}, orphaned has ${orphanedRecords.length}`);
  }

  for (let i = 0; i < orphanedRecords.length && i < backupRecords.length; i++) {
    const orphaned = orphanedRecords[i];
    const source = backupRecords[i];
    
    if (source.payment_id) {
      recoverySQL.push(
        `UPDATE payments SET payment_id = '${source.payment_id}' WHERE uuid = '${orphaned.uuid}';`
      );
      matchedCount++;
    }
  }
}

console.log(`✅ Matched ${matchedCount} payments for recovery`);
console.log(`\n-- Recovery SQL (run on production)\n${recoverySQL.join('\n')}`);

// Also save to file
fs.writeFileSync('alliance-recovery.sql', recoverySQL.join('\n'));
console.log(`\n📄 Saved to: alliance-recovery.sql`);
```

Run it:
```bash
npx ts-node build-alliance-recovery-mapping.ts
```

## Step 6: Execute Recovery on Production

### 6.1 Review Generated SQL

```bash
cat alliance-recovery.sql
```

**Verify**:
- ✅ 20 UPDATE statements (one per cost payment)
- ✅ UUIDs match production orphaned records
- ✅ payment_ids match backup records

### 6.2 Create Backup Transaction

Create `execute-recovery.sql`:

```sql
-- Alliance Highline Cost Payment Recovery
-- Start transaction for atomicity
BEGIN;

-- Save current state for rollback if needed
CREATE TEMP TABLE recovery_audit AS
SELECT uuid, payment_id FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NULL;

-- Execute recovery (copy all UPDATE statements from alliance-recovery.sql here)
UPDATE payments SET payment_id = 'xxx_xx_xxxxxx' WHERE uuid = '...';
UPDATE payments SET payment_id = 'xxx_xx_xxxxxx' WHERE uuid = '...';
-- ... (20 total)

-- Verify recovery
SELECT COUNT(*) as recovered_count
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND waybill_derived = TRUE
  AND payment_id IS NOT NULL;

-- If count = 20, COMMIT; otherwise ROLLBACK;
COMMIT;
```

### 6.3 Execute in Supabase Dashboard

1. Go to production project > **SQL Editor**
2. Create **New Query**
3. Paste the transaction SQL
4. Click **Run**
5. Verify the output shows `recovered_count = 20`

## Step 7: Verify Recovery in Production

### 7.1 Check Payment IDs Are Restored

```sql
SELECT 
    p.uuid,
    p.payment_id,
    p.amount,
    p.financial_code_uuid,
    fc.name as financial_code
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
  AND p.waybill_derived = TRUE
ORDER BY p.financial_code_uuid, p.counteragent_uuid;
```

**Expected**: All 20 records now have `payment_id` populated

### 7.2 Verify UI Functionality

1. Open Alliance Highline project in ICE ERP
2. Check **Payments Report** > **Cost** section
   - Should show payment_ids in all cost entries
   - No more blank payment_id cells
3. Check **Job Distributions**
   - Should be able to allocate to bank transactions
   - Payment amounts should calculate correctly
4. Check **Handovers** page
   - Job distributions should render
   - Paid amounts should calculate properly

### 7.3 Verify Ledger Integrity

```sql
-- Check that accrual/order ledger entries exist for all cost payments
SELECT 
    COUNT(DISTINCT pl.payment_uuid) as payments_with_ledger,
    COUNT(*) as total_ledger_entries
FROM payments_ledger pl
WHERE pl.payment_uuid IN (
    SELECT uuid FROM payments
    WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
      AND waybill_derived = TRUE
);
```

**Expected**: All 20 payments should have corresponding ledger entries

## Step 8: Clean Up Temporary Backup Project

Once recovery is verified:

1. Go to Supabase console
2. Click the temporary backup project
3. Click **Settings** (left menu)
4. Scroll to **Danger zone** at bottom
5. Click **Delete project**
6. Confirm deletion (this removes the temporary database)

**WARNING**: This is permanent. Only delete after step 7 is complete.

## Rollback Plan (If Something Goes Wrong)

### If Recovery Failed or Data Looks Wrong:

1. **Stop immediately** - do NOT proceed with backup deletion
2. **Create new query** on production to inspect data:
   ```sql
   SELECT * FROM payments 
   WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
   LIMIT 5;
   ```
3. **Compare** with the backup CSV to identify issue
4. **Fix manually** in SQL if needed
5. **Verify** with UI tests again
6. **Only then** delete temporary backup project

### If Production is Corrupted:

1. Request Supabase support restore to a **different point-in-time** (earlier)
2. Or restore from another backup
3. Supabase maintains daily backups for 7 days by default

## Prevention for Future

Add to team guidelines:

### When Clearing Payment IDs:

**ALWAYS specify scope**:
- [ ] Income payments only
- [ ] Cost payments only  
- [ ] Both (rare, only with explicit recovery plan)

**BEFORE executing**:
1. Count affected records: `SELECT COUNT(*) FROM payments WHERE ...`
2. Export payment_ids to backup CSV: `SELECT uuid, payment_id FROM payments WHERE ...`
3. Show count to user for confirmation
4. Have user explicitly confirm in UI: "Clear X payment IDs?"

**Add confirmation dialog to UI**:
```typescript
// Example for clearing income payments
const handleClearIncomePaymentIds = async () => {
  const count = await queryPaymentCount({ waybill_derived: false });
  const confirm = window.confirm(
    `⚠️ Clear ${count} INCOME payment IDs?\n\nThis does NOT affect cost payments.`
  );
  if (confirm) await api.clearPaymentIds({ waybill_derived: false });
};
```

## Files Generated by This Process

| File | Purpose |
|------|---------|
| `alliance_cost_payments_backup.csv` | Original cost payments from backup |
| `alliance_orphaned_payments_prod.csv` | Current orphaned records in production |
| `alliance-recovery.sql` | Generated UPDATE statements |
| `execute-recovery.sql` | Full transaction with verification |
| `build-alliance-recovery-mapping.ts` | Mapping script |

## Contact & Support

If issues occur:
- Check Supabase status page: https://status.supabase.com
- Review database activity logs in Supabase Dashboard
- Check application error logs in Vercel
- Contact Supabase support if backup restore fails

---

**Status**: Ready to execute  
**Time Estimate**: 30-45 minutes total (mostly waiting for backup restore)  
**Backup Deletion**: Final step after verification complete  
**Rollback**: Possible if issues discovered before backup deletion
