# Bundle Payment Distribution Investigation - Final Report

## Executive Summary

Investigation revealed that the reported "mismatch" between job distributions and bank transactions was caused by searching the wrong data source. The system correctly uses **raw bank account tables** as the primary data source, but our investigation incorrectly searched the obsolete `consolidated_bank_accounts` table.

## What We Found

### The Mismatch (Initial Report)
- 688K GEL discrepancy: 528K in distributions vs -161K in bank records
- 23 distribution records with "orphaned" `raw_record_uuid` values
- These UUIDs appeared to have no matching bank transactions

### The Root Cause
- `/api/bank-transactions` queries **raw bank tables** (e.g., `GE65TB7856036050100002_TBC_GEL`)
- `consolidated_bank_accounts` is **OBSOLETE** - no longer used
- Investigation script searched `consolidated_bank_accounts` → found nothing
- But all 5 UUIDs **DO exist** in raw table `GE65TB7856036050100002_TBC_GEL`

### Verification Results
All 5 raw_record_uuid values exist in GE65TB7856036050100002_TBC_GEL:
- `caa2cf8c-7009-5a48-8a3c-a1385c5084e4` → 213,504 GEL / 80,000 nominal
- `6ec61407-6c08-5ccd-8847-0b4027ba9ae2` → 213,760 GEL / 80,000 nominal
- `1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a` → 18,802 GEL / 6,698 nominal
- `06f762fc-3ccc-573c-8f93-c18565a717b4` → 41,637 GEL / 14,870 nominal
- `77501426-9a30-5b3f-842a-0270795db7c0` → 40,316 GEL / 14,784 nominal

**Total: 528,019 GEL / 196,352 nominal** (matches distribution total within rounding)

## What We Did

1. **Deleted 23 "orphaned" distributions** (incorrectly identified as orphans)
2. **Created 28 new distributions** (7 payment partitions × 4 jobs)
   - 2 batch payments (BTC_B8F991_9A_E5EE4F, BTC_DEC51D_4E_5A5046) resolved to 4 partitions
   - 3 direct payments (39dbcb_5e_a9dccc appears in both batch and direct)

3. **Distribution weights by job selling price**:
   - L0001: 21.33% ($44,088 selling price)
   - L0002: 26.63% ($55,044 selling price)
   - L0003: 26.02% ($53,783 selling price)
   - L0004: 26.02% ($53,783 selling price)

## The App Works Correctly

The bundle payment distribution system is **working as designed**:

1. **Bank Transaction UI** → fetches from raw tables via `/api/bank-transactions`
2. **Job Distribution Dialog** → receives `raw_record_uuid` from bank transaction
3. **Auto-Distribute Endpoint** → creates `payments_jobs` with `raw_record_uuid`
4. **Data linkage** → `payments_jobs.raw_record_uuid` points to raw table UUIDs

## Key Architectural Facts (Now Documented in AGENTS.md)

### Primary Data Source
- **ACTIVE**: Raw bank account tables (GE65TB7856036050100002_TBC_GEL, GE78BG0000000893486000_BOG_GEL, etc.)
- **OBSOLETE**: consolidated_bank_accounts (do not use)

### Data Flow
```
Bank UI → /api/bank-transactions → UNION query across raw tables
       ↓
Job Distribution Dialog → receives raw_record_uuid
       ↓
/api/payments-jobs/auto-distribute → stores raw_record_uuid in payments_jobs
       ↓
payments_jobs.raw_record_uuid → references raw table UUID
```

### Investigation Protocol
- ❌ NEVER search `consolidated_bank_accounts` to verify `raw_record_uuid`
- ✅ ALWAYS search specific raw table (e.g., `GE65TB7856036050100002_TBC_GEL`)
- ✅ Check `app/api/bank-transactions/route.ts` for list of active source tables
- ✅ Each bank account has own table: `{IBAN}_{BANK}_{CURRENCY}`

## Scripts Created

1. **`verify_deleted_distributions.py`** - Verified all 5 UUIDs exist in raw table
2. **`create_bundle_distributions.py`** - Created 28 distributions weighted by selling price
3. **`root_cause_report.py`** - Generated final analysis report

## Lessons Learned

1. **Verify active architecture** before investigating data integrity issues
2. **Check API routes** to understand which tables are the source of truth
3. **Raw tables are primary** - consolidated_bank_accounts is obsolete
4. **Documentation is critical** - AGENTS.md now includes this architectural fact
5. **Investigation tools must match runtime behavior** - query the same data source the app uses

## Current State (2026-06-06)

✅ **28 distributions created** for project a7380446-a51d-44c2-abf1-0d3a9899d3a2
✅ **Total: 196,352.20 nominal / 528,018.62 GEL**
✅ **Bank transactions: 196,352.25 nominal / 528,018.60 GEL**
✅ **Difference: 0.05 nominal / 0.02 GEL** (rounding only)
✅ **AGENTS.md updated** with bank transaction architecture section

## Recommendation

The system is working correctly. No code changes needed. The only issue was our investigation methodology - now corrected and documented.
