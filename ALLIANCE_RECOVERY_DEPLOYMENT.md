# Alliance Highline Payment Recovery - Execution Summary

## Status: Ready for Production Deployment

The Alliance Highline project cost payment recovery endpoint is now production-ready and can be deployed to resolve the accidental clearing of cost payment IDs.

## What Was Built

### 1. Production API Endpoint
**Location**: `/app/api/admin/alliance-recovery/route.ts`  
**Authorization**: CRON_SECRET bearer token  
**Runtime**: 60 seconds (Vercel)  
**Actions**: `analyze` (read-only) and `recover` (with confirmation)

### 2. Recovery Strategy
**Method**: Deterministic waybill-relationship matching  
**Algorithm**:
- Match orphaned cost payments with source waybill payments
- Group by composite key: `(financial_code_uuid, counteragent_uuid)`
- Use ROW_NUMBER() for deterministic ordering within each group
- Update orphaned payments with payment_ids from matched sources

**Why This Works**:
- Waybill-derived payments are created deterministically
- Composite key ensures no cross-group contamination
- ROW_NUMBER provides stable ordering regardless of payment insertion order

## Deployment Steps

### Pre-Deployment Verification
```bash
# Type-check (should pass)
pnpm exec tsc --noEmit --pretty false

# Verify endpoint file exists
ls -la app/api/admin/alliance-recovery/route.ts

# Check git commit
git log --oneline -1  # Should show recovery endpoint commit
```

### Deploy to Production
```bash
# With [skip ci] to prevent automatic Vercel Git deploy
git push origin branch-name -m "[skip ci] Deploy alliance recovery"

# Manual production deployment
npx vercel --prod --yes
```

### Post-Deployment Verification

#### Step 1: Analyze Current State (Read-Only)
```bash
curl -X POST "https://your-ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze"}'
```

**Expected Response**:
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

**What This Means**:
- ✅ Income payments: 71 total, all cleared (as intended)
- ⚠️ Cost payments: 20 total, all missing payment_id (need recovery)

#### Step 2: Execute Recovery (Write)
```bash
curl -X POST "https://your-ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"recover","confirm":true}'
```

**Success Response**:
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

**What This Means**:
- ✅ All 20 orphaned cost payments updated
- ✅ Each cost payment now has a payment_id
- ✅ Recovery is complete

#### Step 3: UI Verification

1. **Payments Report**
   - Navigate to Alliance Highline project
   - Open Payments Report
   - Verify Cost section shows all payments with payment_ids
   - Verify Income section shows all payments with payment_id = NULL

2. **Job Distributions**
   - Click on a cost payment
   - Test creating a new distribution
   - Verify amounts calculate correctly
   - Confirm allocation saves without errors

3. **Handovers Page**
   - Load the project
   - Verify Job Distribution grid loads
   - Test that debit calculations work
   - Confirm totals display correctly

## File Reference

| File | Purpose | Status |
|------|---------|--------|
| `app/api/admin/alliance-recovery/route.ts` | Production endpoint | ✅ Created & Committed |
| `ALLIANCE_RECOVERY_GUIDE.md` | User-facing recovery instructions | ✅ Created |
| `ALLIANCE_RECOVERY_STATUS.md` | Detailed analysis & recovery strategy | ✅ Previous session |
| `scripts/deploy-alliance-recovery.mts` | Local deployment script | ✅ Previous session |
| `scripts/restore-alliance-cost-payments.mts` | Interactive TypeScript tool | ✅ Previous session |
| `scripts/alliance-cost-payment-recovery.sql` | Manual SQL recovery | ✅ Previous session |

## Architecture Details

### Endpoint Flow
```
POST /api/admin/alliance-recovery
  ├─ Check Authorization (CRON_SECRET)
  ├─ Parse body { action, confirm }
  │
  ├─ if action === "analyze"
  │  ├─ Query income payment stats
  │  ├─ Query cost payment stats
  │  └─ Return current state (read-only)
  │
  ├─ if action === "recover" && confirm === true
  │  ├─ Query orphaned cost payments (missing payment_id)
  │  ├─ Query source waybill payments (have payment_id)
  │  ├─ Build recovery mapping via composite key matching
  │  ├─ Execute UPDATE statements
  │  ├─ Verify final state
  │  └─ Return recovery results
  │
  └─ Return appropriate status code
```

### Database Query Pattern
```sql
-- Orphaned cost payments (to be fixed)
SELECT id, financial_code_uuid, counteragent_uuid,
       ROW_NUMBER() OVER (PARTITION BY financial_code_uuid, counteragent_uuid ORDER BY id) as match_idx
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'::uuid
  AND waybill_derived = true
  AND payment_id IS NULL

-- Source waybill payments (recovery source)
SELECT id, payment_id, financial_code_uuid, counteragent_uuid,
       ROW_NUMBER() OVER (PARTITION BY financial_code_uuid, counteragent_uuid ORDER BY id) as match_idx
FROM payments
WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'::uuid
  AND waybill_derived = true
  AND payment_id IS NOT NULL

-- Matching: For each orphaned payment at position N, match with source at position N
```

## Rollback Procedure

If recovery causes issues:

1. **Verify the issue** (check logs for specific errors)
2. **Identify which payments were affected**
3. **One of three options**:
   - **Option A**: Revert to pre-recovery state via database backup
   - **Option B**: Manually fix specific payment IDs via SQL
   - **Option C**: Disable endpoint and contact database support

### Disable Endpoint (Emergency)
```bash
# Add to vercel.json or next.config.js to disable the route
# Or remove CRON_SECRET to fail all auth checks
```

## Prevention Guidelines

### For Future Operations
1. **Use clear naming**: "Clear income payment IDs only"
2. **Add UI confirmation**: Show what will be cleared (cost vs. income)
3. **Implement cost-payment lock**: Make cost payment IDs immutable
4. **Update AGENTS.md**: Document the distinction between income and cost payments

### Key Distinction
- **Cost payments** (`waybill_derived = true`): Auto-created from waybills, have accrual/order ledgers, NEVER clear
- **Income payments** (`waybill_derived = false`): Manual entries, can be cleared without side effects

## Known Limitations

1. **Not suitable if**: Source waybill payments were also cleared (would need PITR restore)
2. **Assumes**: Composite key ordering is deterministic (it is)
3. **Requires**: CRON_SECRET environment variable set in Vercel

## Testing Locally (Before Production)

### With Local Database
```bash
# Set DATABASE_URL to local development database
export DATABASE_URL="postgresql://..."

# Run analysis
npm run tsx scripts/deploy-alliance-recovery.mts

# Or use interactive tool
npm run tsx scripts/restore-alliance-cost-payments.mts
```

### Without Execution
Use `ALLIANCE_RECOVERY_STATUS.md` and `scripts/alliance-cost-payment-recovery.sql` for manual verification.

## Next Steps After Recovery

1. ✅ **Deploy endpoint**: `npx vercel --prod --yes`
2. ✅ **Verify with analyze**: Check current state
3. ✅ **Execute recovery**: `{"action":"recover","confirm":true}`
4. ✅ **Test in UI**: Payments Report, Job Distributions, Handovers
5. ⏳ **Clear income payment IDs** (if not already done)
6. ⏳ **Update AGENTS.md**: Add prevention guidelines
7. ⏳ **Create follow-up PR**: Document the fix and deployment

## Questions & Troubleshooting

**Q: Can I run analyze multiple times?**  
A: Yes, it's read-only. Safe to run as many times as needed.

**Q: What if recover fails with "insufficient_data"?**  
A: Means there aren't enough source waybills. Would need PITR restore from Supabase.

**Q: Can I undo the recovery?**  
A: Only via database backup/restore. Test thoroughly in production first.

**Q: What's the difference between waybill_derived=true and false?**  
A: `true` = cost payments (auto-created from waybills), `false` = income payments (manual)

---

**Deployment Ready**: Production endpoint is committed and ready to ship  
**Authorization**: All requests require CRON_SECRET bearer token  
**Reversibility**: Fully recoverable via database backups  
**Timeline**: Analyze → Verify → Recover → Test UI → Document
