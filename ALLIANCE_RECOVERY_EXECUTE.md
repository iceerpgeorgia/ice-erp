# Alliance Highline Recovery - EXECUTION GUIDE

**Status**: ✅ Production deployed and ready to execute  
**Last Updated**: 2026-11-13  
**Project**: Alliance Highline | 1.1.1 | ალიანსი თბილისი  
**Project UUID**: `dc975886-9bf9-42c8-afbe-87695aa01262`  
**Affected Records**: 20 cost payments needing recovery

---

## Quick Start (Fastest Path - 2 minutes)

If you've verified data exists (via backup), execute this:

```bash
# Step 1: Analyze current state (read-only, safe)
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze"}'

# Expected response indicates 20 orphaned cost payments needing recovery

# Step 2: Execute recovery (REQUIRES confirmation)
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"recover","confirm":true}'

# Expected: HTTP 200, "Successfully recovered 20 cost payments"
```

**That's it!** Recovery complete. Proceed to verification step.

---

## Recommended Path (Safety First - 30-45 minutes)

### Phase 1: Verify Data in Backup (No Production Changes)

**Duration**: 20-30 minutes (mostly backup restore time)

1. **Restore Supabase Backup**
   - Go to https://supabase.com → Select ice-erp project
   - Settings → Backups → Restore to new project
   - Choose backup from **before deletion** (check timestamps)
   - Create new temporary project
   - Wait for restore (5-15 minutes)

2. **Query Backup Database**
   - Get backup connection string from restore confirmation email
   - Query cost payments with payment_ids:
   ```sql
   SELECT COUNT(*), payment_id FROM payments
   WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
     AND waybill_derived = TRUE
   GROUP BY 1
   LIMIT 5;
   ```
   - Export to CSV if needed

3. **Confirm Recovery Data Exists**
   - Should see 20 records with payment_id populated
   - Note the payment_id values
   - ✅ Proceed to Phase 2

### Phase 2: Execute Production Recovery (2 minutes)

Now that you've confirmed data exists, execute the API endpoint:

```bash
# Step 1: Analyze (confirms recovery is needed)
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"analyze"}'

# Step 2: Recover (with confirmation)
curl -X POST "https://ice-erp.vercel.app/api/admin/alliance-recovery" \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"recover","confirm":true}'
```

### Phase 3: Verify in Production (5 minutes)

1. **Check Database**
   ```bash
   curl "https://fojbzghphznbslqwurrm.supabase.co/rest/v1/payments?project_uuid=eq.dc975886-9bf9-42c8-afbe-87695aa01262&waybill_derived=eq.true&select=uuid,payment_id" \
     -H "Authorization: Bearer YOUR_SUPABASE_KEY" | jq '.[] | select(.payment_id == null) | "❌ Still orphaned"' | wc -l
   # Should return 0 (no orphaned records)
   ```

2. **Test in UI**
   - Open https://ice-erp.vercel.app
   - Navigate to **Alliance Highline** project
   - Go to **Dictionaries** → **Payments Report**
   - Filter: Project = Alliance Highline, Type = Cost
   - ✅ All rows should have payment_id values (not blank)
   - Click a payment to view → should show in **Job Distributions**

3. **Test Job Distributions**
   - Go to **Handovers** page
   - Select **Alliance Highline** project
   - Check **Job Distributions** grid
   - ✅ Should show bank transactions with allocations
   - ✅ "Paid" columns should calculate correctly

### Phase 4: Clean Up (2 minutes)

1. **Delete Temporary Backup Project**
   - Go to https://supabase.com
   - Select temporary backup project
   - Settings → Danger Zone → Delete Project
   - Confirm deletion
   - ⚠️ **This is permanent**

2. **Archive Recovery Documentation**
   - Keep these files for audit trail:
     - `ALLIANCE_RECOVERY_GUIDE.md`
     - `ALLIANCE_BACKUP_RECOVERY_GUIDE.md`
     - `ALLIANCE_RECOVERY_PATHS.md`
   - Note: Already in git with timestamps

---

## Environment Variables Required

Before executing recovery, ensure you have:

```bash
# CRON_SECRET - required for API authorization
export CRON_SECRET="your-cron-secret-here"

# SUPABASE_KEY - optional, only needed for direct DB queries
export SUPABASE_KEY="your-supabase-key-here"
```

**Where to find CRON_SECRET**:
- Vercel Dashboard → ice-erp project → Settings → Environment Variables → CRON_SECRET
- Used by all `/api/cron/*` and `/api/admin/*` routes

---

## Expected Responses

### Analyze Action (Read-Only)

**Request**:
```json
{"action":"analyze"}
```

**Success Response**:
```json
{
  "success": true,
  "analysis": {
    "total_cost_payments": 20,
    "with_payment_id": 0,
    "missing_payment_id": 20,
    "source_payments_available": true,
    "recovery_needed": true
  }
}
```

**Meaning**: 20 orphaned cost payments found, recovery is needed and possible.

### Recover Action (Requires confirm=true)

**Request**:
```json
{
  "action": "recover",
  "confirm": true
}
```

**Success Response**:
```json
{
  "success": true,
  "recovery": {
    "updated_count": 20,
    "messages": ["Successfully recovered 20 cost payments"]
  }
}
```

**Meaning**: All 20 payments have been updated with their original payment_ids.

---

## Troubleshooting

### "401 Unauthorized"
- **Cause**: Missing or incorrect CRON_SECRET
- **Fix**: Check Vercel environment variables
- **Verify**:
  ```bash
  echo $CRON_SECRET  # Should print your secret
  ```

### "500 Internal Server Error"
- **Cause**: Database connection or query error
- **Fix**: Check Supabase status at https://status.supabase.com
- **Debug**: Check Vercel function logs:
  ```bash
  npx vercel logs ice-erp --prod --limit 50
  ```

### "insufficient_data" in response
- **Cause**: Not enough source waybill payments to recover all orphaned records
- **Fix**: Fall back to manual SQL recovery (see ALLIANCE_BACKUP_RECOVERY_GUIDE.md)
- **Alternative**: Restore from earlier Supabase backup

### "Action completed but verify shows still orphaned"
- **Cause**: Rare race condition in verification query
- **Fix**: Wait 10 seconds and run analyze again
- **Debug**: Query database directly:
  ```sql
  SELECT COUNT(*) FROM payments 
  WHERE project_uuid = 'dc975886-9bf9-42c8-afbe-87695aa01262'
    AND waybill_derived = TRUE 
    AND payment_id IS NULL;
  ```

---

## Safety Checklist

Before executing recovery:

- [ ] You have `CRON_SECRET` available
- [ ] You can access Supabase (if using backup verification)
- [ ] You have read all documentation
- [ ] You understand the two recovery paths
- [ ] You've backed up current state (optional but recommended)

Before deleting backup project:

- [ ] Verify step 3 completed successfully
- [ ] Payment IDs show in Payments Report
- [ ] Job Distributions work correctly
- [ ] Handovers page calculates accurately
- [ ] No errors in application logs

---

## Recovery Timeline

| Phase | Task | Duration | Status |
|-------|------|----------|--------|
| 1 | Start backup restore | N/A | Ready (if using path 2) |
| 2 | Wait for restore | 5-15 min | Waiting |
| 3 | Query backup data | 5 min | Ready |
| 4 | Execute API recovery | 30 sec | ⏳ On-demand |
| 5 | Verify in UI | 5 min | Ready |
| 6 | Delete backup project | 2 min | Ready |
| **Total** | **All phases** | **30-45 min** | **Ready** |

**Fast path** (skip backup verification): 2 minutes

---

## Files Available for Reference

| File | Purpose |
|------|---------|
| `ALLIANCE_RECOVERY_GUIDE.md` | Quick API endpoint recovery guide |
| `ALLIANCE_BACKUP_RECOVERY_GUIDE.md` | Detailed backup restore procedure |
| `ALLIANCE_RECOVERY_PATHS.md` | Comparison of recovery options |
| `ALLIANCE_RECOVERY_READY.md` | Deployment readiness summary |
| `app/api/admin/alliance-recovery/route.ts` | Production endpoint source code |
| `scripts/alliance-recovery-backup-match.ts` | CSV matching script for backup method |
| `docs/DEPLOYMENT_LOG.md` | Deployment record (entry #412) |

---

## Next Steps

**Choose your path and execute**:

1. **Path A (Fastest)**: Execute API endpoint immediately
   ```bash
   # See "Quick Start" section above
   ```

2. **Path B (Safest)**: Verify with backup first, then API
   ```bash
   # See "Recommended Path" section above
   ```

3. **Path C (Manual)**: Full manual recovery using SQL
   ```bash
   # See ALLIANCE_BACKUP_RECOVERY_GUIDE.md sections 4-8
   ```

**Recommended**: Path B (30-45 min total, maximum safety)

---

## Support & Escalation

| Issue | Action |
|-------|--------|
| API endpoint not responding | Check Vercel logs, verify CRON_SECRET |
| Backup restore failing | Contact Supabase support with project ID |
| SQL matching script error | Run with `--debug` flag to see detailed output |
| UI verification failed | Check Payments Report filtering, check browser console |
| Unable to delete backup project | Contact Supabase support, may need force delete |

---

**Last Deployment**: 2026-11-13  
**Recovery Endpoint**: `https://ice-erp.vercel.app/api/admin/alliance-recovery`  
**Status**: ✅ Production ready  
**Action Required**: Execute recovery (recommended in next 24 hours to restore UI functionality)
