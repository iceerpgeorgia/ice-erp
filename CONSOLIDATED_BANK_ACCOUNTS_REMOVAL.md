# consolidated_bank_accounts Removal Summary

**Date**: 2026-06-06  
**Status**: ✅ Complete (pending Supabase table drop)

## Why Removed?

Investigation revealed that `consolidated_bank_accounts` is **completely obsolete**:

1. **API uses raw tables**: `/api/bank-transactions` queries raw bank account tables via UNION (see SOURCE_TABLES in route.ts)
2. **Not written to**: No active code inserts or updates this table
3. **Not read from**: All bank transaction queries use raw tables
4. **Caused confusion**: Led to false "orphaned data" investigation because verification searched wrong table

## What Was Removed

### 1. Code References ✅ Complete

| File | Change | Status |
|------|--------|--------|
| `prisma/schema.prisma` | Removed `ConsolidatedBankAccount` model | ✅ Done |
| `app/api/projects/route.ts` | Removed 2 queries (bundle cleanup checks) | ✅ Done |
| `app/api/bank-transactions/[id]/route-supabase.ts` | Deleted entire file (obsolete update route) | ✅ Done |
| `AGENTS.md` | Updated architecture docs | ✅ Done |

### 2. Database Table ⏳ Pending

The `consolidated_bank_accounts` table still exists in Supabase but is not used by any code.

**To drop the table, run:**
```bash
python drop_consolidated_bank_accounts.py
```

This will:
- Show current table stats (row count, size)
- Prompt for confirmation ("DROP TABLE")
- Execute `DROP TABLE consolidated_bank_accounts CASCADE`
- Remove all indexes, constraints, and data

### 3. Legacy Files 🗂️ Ignored

Many legacy migration/check scripts reference `consolidated_bank_accounts`. These are **not** active code and can be safely ignored:
- `add-*-column.js/py` - old migration scripts
- `check-*.js/py` - investigation scripts
- `apply-*.js/py` - one-time setup scripts
- SQL files in project root

These scripts are historical artifacts and won't be executed.

## Architecture After Removal

```
Bank Transaction Data Flow:

┌─────────────────────────────────────────┐
│ Raw Bank Account Tables (Supabase)     │
│ - GE65TB7856036050100002_TBC_GEL       │
│ - GE78BG0000000893486000_BOG_GEL       │
│ - GE74BG0000000586388146_BOG_USD       │
│ - ... (14 tables total)                 │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ /api/bank-transactions (Local DB)      │
│ - UNION query across all raw tables    │
│ - Returns raw_record_uuid               │
│ - Resolves batch partitions             │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ Job Distribution UI                     │
│ - Receives raw_record_uuid              │
│ - Creates payments_jobs with raw UUID   │
└─────────────────────────────────────────┘
            ↓
┌─────────────────────────────────────────┐
│ payments_jobs Table (Local DB)          │
│ - raw_record_uuid → raw table UUID      │
│ - batch_partition_uuid → batch UUID     │
└─────────────────────────────────────────┘
```

## Post-Removal Steps

After running `drop_consolidated_bank_accounts.py`:

1. **Regenerate Prisma Client**:
   ```bash
   pnpm prisma generate
   ```
   This updates the generated client to remove ConsolidatedBankAccount types.

2. **Verify TypeScript Compilation**:
   ```bash
   pnpm exec tsc --noEmit --pretty false
   ```
   Should pass with no errors (all references removed).

3. **Test Bank Transactions API**:
   - Visit bank transactions page in UI
   - Verify data loads correctly
   - Test job distribution dialog

## Rollback (If Needed)

If you need to restore `consolidated_bank_accounts` (unlikely):

1. Revert `prisma/schema.prisma` to previous commit
2. Restore `app/api/projects/route.ts` references
3. Restore `app/api/bank-transactions/[id]/route-supabase.ts`
4. Run: `pnpm prisma db pull` to restore from Supabase
5. Run: `pnpm prisma generate`

**Note**: This would restore the schema but NOT the data (data is deleted by DROP TABLE).

## Benefits

✅ **Cleaner codebase**: Removed obsolete model and API route  
✅ **No confusion**: Single source of truth (raw tables only)  
✅ **Faster queries**: No unnecessary consolidation step  
✅ **Accurate docs**: AGENTS.md reflects actual architecture  
✅ **Disk space**: Frees up space in Supabase (table + indexes)

## Files Changed

```
Modified:
- prisma/schema.prisma (removed ConsolidatedBankAccount model)
- app/api/projects/route.ts (removed 2 queries)
- AGENTS.md (updated architecture section)

Deleted:
- app/api/bank-transactions/[id]/route-supabase.ts

Created:
- drop_consolidated_bank_accounts.py (table drop script)
- CONSOLIDATED_BANK_ACCOUNTS_REMOVAL.md (this file)
```

## Next Action

Run the drop script to complete the removal:

```bash
python drop_consolidated_bank_accounts.py
```

Type `DROP TABLE` when prompted to confirm deletion.
