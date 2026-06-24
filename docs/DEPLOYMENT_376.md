# Deployment #376 - Fix Handover Emissions API Errors

**Status:** Code deployed to production ✅ | Database migration pending ⏳

**Production URL:** https://ice-58k2efbz0-iceerp.vercel.app

## Problem Resolved

The Handovers page was returning 500 errors on multiple API endpoints. Investigation revealed the root cause: The handover_emissions database migration was not applied to production, causing:

1. `/api/payments-jobs` missing `emission_uuid` and `emission_date` fields in response
2. Missing `handover_emissions` table in production database  
3. Missing trigger functions to prevent modifying emitted records

## Code Changes Applied (Deployment #376)

### Modified: [app/api/payments-jobs/route.ts](app/api/payments-jobs/route.ts)

**1. GET Response - Added emission fields (lines 130-131)**
```typescript
emission_uuid: d.emission_uuid,
emission_date: d.emission_date ? d.emission_date.toISOString() : null,
```

**2. POST Handler - Added emission guards for replace_all (lines 303-312)**
- Check for records where `emission_uuid IS NOT NULL`
- Prevent deletion of emitted records with descriptive error message
- Protects data integrity for locked distributions

**3. POST Handler - Added emission guards for upsert (lines 364-370)**
- Check if existing record has `emission_uuid` set
- Prevent updates to emitted records with descriptive error message
- Allows creation of new distributions but prevents modification of locked ones

### Created: [scripts/apply-handover-emissions-migration.sql](scripts/apply-handover-emissions-migration.sql)

Complete SQL script to apply the missing database migration in Supabase. Includes:
- Create `handover_emissions` table
- Add `emission_uuid` and `emission_date` columns to `payments_jobs`
- Create indexes for performance
- Add foreign key constraints
- Create trigger functions to enforce business rules
- Verification query to confirm success

## Next Steps (Manual - Required for full fix)

### Step 1: Apply Database Migration in Supabase

1. Log into [Supabase Dashboard](https://supabase.com)
2. Navigate to **SQL Editor** for ice-erp project
3. Create new query
4. Copy entire contents of: `scripts/apply-handover-emissions-migration.sql`
5. Click **Run** button
6. Verify all statements execute successfully

**Expected Result:**
```
handover_emissions_table_exists: true
emission_uuid_column_exists: true
emission_date_column_exists: true
triggers_exist: true
```

### Step 2: Verify Production APIs Respond Correctly

Test the following endpoints should now return 200:

1. **GET /api/payments-jobs**
   ```bash
   curl -H "Authorization: Bearer <token>" \
        "https://ice-58k2efbz0-iceerp.vercel.app/api/payments-jobs?project_uuid=..."
   ```
   Should include in response: `emission_uuid`, `emission_date`

2. **Handovers Page Load**
   Navigate to: https://ice-58k2efbz0-iceerp.vercel.app/handovers
   - Should load without React errors
   - Distributions table should display normally

### Step 3: Test Emission Workflow (Optional)

Once database migration is applied:
1. Verify distributions cannot be updated if they have `emission_uuid` set
2. Confirm "emitted" status appears in UI when applicable
3. Test error messages when attempting to modify locked distributions

## Architecture Context

**Handover Emissions Feature:**
- Allows distributions to be "locked" after export to handover document
- Prevents accidental modifications to data already submitted to handover
- Uses database triggers to enforce business rules
- Maintains audit trail via `emission_date` and `emission_uuid` fields

**Data Flow:**
1. User creates payment distributions in Handovers page
2. User exports handover document (XLSX)
3. Export process creates `handover_emissions` record
4. All exported distributions get `emission_uuid` set
5. Locked distributions cannot be updated/deleted (enforced by triggers)

## Rollback Plan

If issues arise after database migration:
1. Set `DISABLE_EMISSIONS=true` in `.env.local` (if implemented)
2. API will still return emission fields but enforcement is optional
3. Contact DBA to evaluate reverting migration

## Related Issues

- Subagent audit found 2 issues, 4 APIs verified clean
- Emission feature code (Deployment #372) already deployed
- Database schema was missing, causing API type mismatches

## Files Modified

- `app/api/payments-jobs/route.ts` - Added emission field support and guards
- `scripts/apply-handover-emissions-migration.sql` - Database migration script (NEW)

---

**Deployment Time:** ~15 seconds  
**Build Status:** ✅ No errors  
**Deploy Status:** ✅ Production active

**Next Action:** Apply database migration in Supabase SQL Editor, then test endpoints.
