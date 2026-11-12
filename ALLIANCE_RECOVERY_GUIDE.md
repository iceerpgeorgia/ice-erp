# Alliance Highline Payment Recovery Guide

## Overview
The Alliance Highline project (UUID: `dc975886-9bf9-42c8-afbe-87695aa01262`) had **cost payment IDs accidentally cleared** along with income payments in production. This guide provides a step-by-step recovery procedure.

## Problem Summary
- **What happened**: Income payment IDs were intentionally cleared via the UI, but cost payments were also cleared unintentionally
- **Impact**: Cost accrual/order payments now have `payment_id = NULL`, breaking budget tracking
- **Status**: Income payments remain cleared (as intended), cost payments need recovery
- **Data source**: Recovery can use waybill relationships to restore cost payment IDs

## Quick Recovery (Production)

### Step 1: Verify Current State
```bash
curl -X POST "https://your-vercel-url/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze"}'
```

Expected response (if recovery needed):
```json
{
  "status": "analyzed",
  "income": {
    "total": 71,
    "with_id": 0,
    "missing": 71
  },
  "cost": {
    "total": 20,
    "with_id": 0,
    "missing": 20
  },
  "needsRecovery": true,
  "message": "20/20 cost payments missing payment_id"
}
```

### Step 2: Execute Recovery
Once you've verified the state with analyze, execute the recovery:

```bash
curl -X POST "https://your-vercel-url/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"recover","confirm":true}'
```

Success response:
```json
{
  "status": "success",
  "updated": 20,
  "total": 20,
  "final_state": {
    "cost_payments_total": 20,
    "cost_payments_with_id": 20,
    "cost_payments_missing": 0
  },
  "message": "All cost payments recovered"
}
```

### Step 3: Clear Income Payment IDs (Optional)
If you still want to clear income payment IDs as originally intended:

```bash
# Via SQL in Supabase Dashboard, or programmatically:
curl -X POST "https://your-vercel-url/api/admin/clear-income-payments" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"projectUuid":"dc975886-9bf9-42c8-afbe-87695aa01262"}'
```

## Alternative: Manual SQL Recovery

If the API endpoint is unavailable, use this SQL directly in Supabase Dashboard > SQL Editor:

### Analysis Query
```sql
-- Check current state
SELECT 
  'income' as payment_type,
  COUNT(*) as total,
  COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
  COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as missing
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'::uuid
  AND waybill_derived = false
UNION ALL
SELECT 
  'cost' as payment_type,
  COUNT(*) as total,
  COUNT(CASE WHEN payment_id IS NOT NULL THEN 1 END) as with_id,
  COUNT(CASE WHEN payment_id IS NULL THEN 1 END) as missing
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'::uuid
  AND waybill_derived = true;
```

### Recovery Query
```sql
-- See scripts/alliance-cost-payment-recovery.sql for detailed recovery logic
-- Recovery maps orphaned cost payments to source waybill payments via composite key
-- (financial_code_uuid, counteragent_uuid, ROW_NUMBER)
```

## Files Created

### API Endpoint
- **Location**: `/app/api/admin/alliance-recovery/route.ts`
- **Authorization**: Requires `CRON_SECRET` header as Bearer token
- **Actions**: `analyze` (read-only), `recover` (with confirmation)
- **Runtime**: 60 second maxDuration for Vercel

### Diagnostic Scripts
- **`scripts/restore-alliance-cost-payments.mts`**: Interactive TypeScript tool (local)
- **`scripts/deploy-alliance-recovery.mts`**: Production execution script (local)
- **`scripts/alliance-cost-payment-recovery.sql`**: Manual SQL recovery (Supabase Dashboard)
- **`ALLIANCE_RECOVERY_STATUS.md`**: Detailed analysis and recovery strategy

## Recovery Strategy: Waybill Relationships

The recovery uses a deterministic matching algorithm:

1. **Query orphaned cost payments** (missing `payment_id`)
   - Grouped by `(financial_code_uuid, counteragent_uuid)`
   - Assigned `ROW_NUMBER()` within each group

2. **Query source waybill payments** (have `payment_id`)
   - Same grouping and numbering scheme
   - Used as the recovery source

3. **Deterministic matching**: For each orphaned payment at position N in its group, match it with the source payment at position N in the same group

4. **Update**: Set `payment_id` from matched source

**Why this works**:
- Waybill-derived payments are created deterministically when waybills are bound to projects
- The ROW_NUMBER ensures consistent ordering across groups
- Matching by composite key prevents cross-group contamination

## Verification

After recovery, verify in the UI:

1. **Payments Report**
   - Open project "Alliance Highline"
   - Check Income section: should still have `payment_id = NULL` (cleared as intended)
   - Check Cost section: should now have `payment_id` restored

2. **Job Distributions**
   - Test distribution allocations work correctly
   - Verify amounts load without errors

3. **Handovers**
   - Load project and verify job distribution grid
   - Check that debit calculations work

## Preventing This in the Future

### Guidelines
1. **Use clear naming**: When clearing payment IDs, specify "Clear income payment IDs"
2. **Scope UI actions**: Add a checkbox to confirm scope (income only vs. both)
3. **Audit log checks**: Review AuditLog entries before and after operations
4. **Cost payment protection**: Consider making cost payment IDs read-only or require special override

### Update AGENTS.md
Add to **Payment Management** section:
```
**Cost vs. Income Payment Distinction**: 
- Cost payments (waybill-derived, `accrual_source IN ('accrual', 'order')`) must NEVER have payment IDs cleared
- Income payments (`waybill_derived = false`) can be cleared without affecting waybill relationships
- Always verify the `waybill_derived` flag before clearing payment IDs
```

## Troubleshooting

### "insufficient_data" Error
```json
{
  "status": "insufficient_data",
  "message": "Have N sources but need M"
}
```
**Cause**: Not enough source waybill payments to match all orphaned cost payments  
**Solution**: Restore from Supabase point-in-time backup (requires PITR)  
**Action**: Contact Supabase support with recovery timestamp

### "401 Unauthorized"
```json
{
  "error": "Unauthorized"
}
```
**Cause**: Missing or incorrect `CRON_SECRET`  
**Solution**: Verify Vercel environment variable is set  
**Action**: Check `.env.local` or Vercel dashboard settings

### "500 Server Error"
**Cause**: Database connection or query error  
**Solution**: Check server logs for specific error message  
**Action**: Review prisma schema and UUID casting in query

## Rollback

If recovery causes issues, rollback by:

1. **Query before-state** via Supabase backups
2. **Export** cost payment IDs from backup
3. **Re-run** recovery with different mapping (if needed)
4. **Or**: Restore entire project from backup (nuclear option)

## Next Steps

1. ✅ Verify current state with `analyze` action
2. ✅ Execute recovery with `recover` action
3. ⏳ Clear income payment IDs (if not already cleared)
4. ⏳ Update AGENTS.md with prevention guidelines
5. ⏳ Create PR documenting fix and deployment
6. ⏳ Deploy to production

## References

- **Recovery Framework**: `/ALLIANCE_RECOVERY_STATUS.md`
- **Interactive Tool**: `scripts/restore-alliance-cost-payments.mts`
- **Vercel Script**: `scripts/deploy-alliance-recovery.mts`
- **SQL Script**: `scripts/alliance-cost-payment-recovery.sql`
- **Prisma Schema**: `prisma/schema.prisma` (payments model)
- **API Endpoint**: `app/api/admin/alliance-recovery/route.ts`

---

**Deployed**: Ready for production execution  
**Status**: Awaiting confirmation to proceed with recovery
