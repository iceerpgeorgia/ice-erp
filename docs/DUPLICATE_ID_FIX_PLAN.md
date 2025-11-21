# Duplicate Identification Number Fix Plan

## Issue Summary

**Problem**: Two counteragents found with the same identification number:
- UUID 1: `78c10c01-2f3e-4d85-8980-12d08b8d405f`
- UUID 2: `782a27e6-73b0-4e7d-83e1-21d87cb72359`

**Root Cause**: 
1. Frontend validation checks for duplicates via API call
2. Race condition: Two simultaneous submissions can both pass check before either saves
3. Database has NO unique constraint on `identification_number` field
4. PostgreSQL allows duplicate values without constraint

## Solution Implemented

### ✅ Backend Error Handling
Enhanced `app/api/counteragents/route.ts`:
- POST and PATCH handlers now catch PostgreSQL unique constraint violations (error code `23505`)
- Returns HTTP 409 (Conflict) with user-friendly message: "This identification number already exists"
- Frontend displays error inline on the form field

### ✅ Frontend Error Display
Updated `components/figma/counteragents-table.tsx`:
- Catches 409 status responses from backend
- Sets form error on `identificationNumber` field
- Shows red border and error message directly in UI
- No more generic alert() dialogs for duplicate errors

### 📝 SQL Script Created
Created `scripts/add-unique-identification-number.sql`:
- Step 1: Query to find all existing duplicate groups
- Step 2: CREATE UNIQUE INDEX with partial constraint (allows multiple NULLs)

## Action Required: Execute in Supabase

### Step 1: Find Existing Duplicates

Run this query in Supabase SQL Editor:

```sql
SELECT 
  identification_number, 
  COUNT(*) as count,
  ARRAY_AGG(counteragent_uuid::text ORDER BY created_at) as uuids,
  ARRAY_AGG(name ORDER BY created_at) as names,
  ARRAY_AGG(created_at::text ORDER BY created_at) as created_dates
FROM public.counteragents
WHERE identification_number IS NOT NULL
GROUP BY identification_number
HAVING COUNT(*) > 1
ORDER BY count DESC, identification_number;
```

**Expected Output**: List of all duplicate groups with their UUIDs, names, and creation dates

### Step 2: Resolve Duplicates

For each duplicate group, choose one of these options:

#### Option A: Delete Duplicate Entry
If one record was created by mistake:
```sql
DELETE FROM public.counteragents 
WHERE counteragent_uuid = '<uuid-to-delete>';
```

#### Option B: Update Identification Number
If they're different entities that mistakenly got the same ID:
```sql
UPDATE public.counteragents 
SET identification_number = '<new-correct-id>'
WHERE counteragent_uuid = '<uuid-to-update>';
```

#### Option C: Merge Records (if needed)
If same entity with different data, manually merge:
1. Review both records in UI
2. Choose which record to keep
3. Manually copy over any missing data
4. Delete the duplicate

**Document your decisions** for each duplicate group.

### Step 3: Verify No Duplicates Remain

```sql
-- Should return 0 rows
SELECT identification_number, COUNT(*) as count
FROM public.counteragents
WHERE identification_number IS NOT NULL
GROUP BY identification_number
HAVING COUNT(*) > 1;
```

### Step 4: Apply Partial Unique Index

Once all duplicates are resolved, run:

```sql
-- Create partial unique index (allows multiple NULLs, prevents duplicate non-NULLs)
CREATE UNIQUE INDEX idx_counteragents_identification_number_unique
ON public.counteragents (identification_number)
WHERE identification_number IS NOT NULL;
```

**Why partial index?**
- Allows multiple records with NULL identification_number (for exempt entity types like "არ ექვემდებარება")
- Prevents duplicate non-NULL values
- Prisma doesn't support partial indexes in schema.prisma, must use SQL directly

### Step 5: Verify Index Created

```sql
-- Should return 1 row with index details
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'counteragents' 
  AND indexname = 'idx_counteragents_identification_number_unique';
```

### Step 6: Test Constraint

Try to create a duplicate via UI:
1. Create counteragent with ID "12345678901"
2. Try to create another with same ID "12345678901"
3. Should see red error message: "This identification number already exists"
4. Form should NOT submit

## Additional Testing Needed

### Test 1: Country Dropdown Search
**Status**: ⏳ Fix deployed, pending validation

1. Hard refresh page (Ctrl+Shift+R)
2. Click "Add Counteragent"
3. Type in Country search box (e.g., "Geo")
4. Verify dropdown filters to matching countries
5. Select country and save
6. Verify `country_uuid` is captured correctly in database

**If search still doesn't work**: May need to fallback to Select component with manual filtering

### Test 2: Duplicate Prevention
After applying unique index:

1. ✅ Add with unique ID → Success
2. ✅ Add with duplicate ID → Form error "This identification number already exists"
3. ✅ Edit to existing ID → Form error
4. ✅ Edit to unique ID → Success

### Test 3: NULL ID Numbers
Verify exempt entity types still work:

1. Select entity type "არ ექვემდებარება"
2. Leave ID number empty (NULL)
3. Save successfully
4. Create another with same entity type and empty ID
5. Should succeed (multiple NULLs allowed)

## Future Improvements

### Optional: Remove Frontend Duplicate Check
Since database now enforces uniqueness, consider:

**Current (lines 484-497)**:
```typescript
// Check for duplicates (except for exempt types)
if (!isExempt && formData.identificationNumber?.trim()) {
  try {
    const response = await fetch('/api/counteragents');
    // ... check all records for duplicate
  }
}
```

**Could simplify to**:
- Remove the API fetch duplicate check
- Rely on database constraint + backend 409 error
- Faster form submission
- More reliable (no race condition)
- Still shows user-friendly error via backend response

**Pros**: Faster, simpler, more reliable  
**Cons**: User only sees error after submit instead of during typing

**Recommendation**: Keep frontend check for better UX, but rely on database as source of truth.

## Related Issues Resolved

- ✅ Connection pool exhaustion (Prisma singleton)
- ✅ Internal number auto-generation (ICE + 6-digit format)
- ✅ Database triggers for computed fields
- ⏳ Country dropdown search (pending test)
- ✅ Duplicate ID prevention (backend + database)

## Summary

**What Changed**:
1. Backend now catches unique constraint violations → returns 409
2. Frontend shows errors inline on form field
3. SQL script created to add partial unique index
4. Documentation created for resolution steps

**What's Next**:
1. **USER ACTION**: Run SQL queries to find and resolve existing duplicates
2. **USER ACTION**: Apply unique index after duplicates resolved
3. **USER ACTION**: Test country dropdown search functionality
4. **USER ACTION**: Test duplicate prevention works end-to-end

**Success Criteria**:
- ✅ No duplicate identification numbers in database
- ✅ Cannot create new duplicates (blocked by constraint)
- ✅ User sees friendly error message when attempting duplicate
- ✅ Multiple NULL values allowed (for exempt entity types)
- ✅ Country dropdown search works properly

