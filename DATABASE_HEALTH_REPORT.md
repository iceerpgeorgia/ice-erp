# Database Health Check Report
**Date**: November 19, 2025

## 🔍 Findings

### ✅ **1. Duplicate Identification Numbers**
**Status**: ✅ **RESOLVED** - No duplicates found!

The two UUIDs you mentioned earlier have been cleaned up:
- 78c10c01-2f3e-4d85-8980-12d08b8d405f
- 782a27e6-73b0-4e7d-83e1-21d87cb72359

No action needed on this front.

---

### ❌ **2. NBG Exchange Rates - CRON JOB NOT RUNNING**
**Status**: ❌ **CRITICAL** - Data is 5 days old

**Current State**:
- Latest rate in database: **November 13, 2025**
- Today's date: **November 19, 2025**
- Data age: **5 days old**
- Missing rates: 4-6 days (including weekends)

**Latest Rates** (Nov 13, 2025):
```
USD: 2.7059 GEL
EUR: 3.1310 GEL
CNY: 0.3802 GEL
GBP: 3.5507 GEL
RUB: 0.0334 GEL
TRY: 0.0641 GEL
AED: 0.7367 GEL
KZT: 0.0052 GEL
```

**Root Causes**:
1. ⚠️ Cron schedule was wrong: `15:00 UTC` instead of `19:00 UTC`
2. ⚠️ `CRON_SECRET` may not be set in Vercel
3. ⚠️ Cron job failing silently

**Actions Taken**:
- ✅ Fixed cron schedule in `vercel.json`: Changed to `19:00 UTC` (23:00 Georgian)
- ✅ Added `CRON_SECRET` to `.env.example`

**Actions Required**:
1. **Set CRON_SECRET in Vercel**:
   ```bash
   # Generate secret
   openssl rand -base64 32
   ```
   
2. **Add to Vercel Environment Variables**:
   - Go to: https://vercel.com/iceerpgeorgia/ice-erp/settings/environment-variables
   - Add: `CRON_SECRET` = `<generated-secret>`
   - Environments: Production, Preview, Development

3. **Deploy Changes**:
   ```bash
   git add vercel.json .env.example
   git commit -m "fix(cron): update NBG schedule to 19:00 UTC and add CRON_SECRET"
   git push origin feat/add-entry-model
   ```

4. **Manual Update** (immediate):
   - Go to: https://iceerpgeorgia.com/dictionaries/nbg-rates
   - Click "Update from NBG" button
   - Or run: `node scripts/update-nbg-rates.py`

---

### ⚠️ **3. Internal Numbers - INCONSISTENT FORMAT**
**Status**: ⚠️ **NEEDS STANDARDIZATION**

**Current State**:
- Total counteragents: **3,283**
- Correct format & ID match: **1** (0.03%)
- Incorrect/mismatched: **3,280** (99.94%)
- NULL (not set): **2** (0.06%)

**Issue**: Internal numbers don't match the ID-based format
- Example: ID 1 has `ICE000123` instead of `ICE000001`
- Example: ID 2 has `ICE000212` instead of `ICE000002`

**Explanation**:
The internal numbers were assigned sequentially as records were created, but not based on the database ID. This means:
- They are unique ✅
- They follow ICE format ✅
- But they don't match the ID number ❌

**Question**: Do you want to:

**Option A**: Keep current numbers (they're already assigned and in use)
- Pros: No changes needed, numbers already in use
- Cons: Number doesn't match database ID

**Option B**: Standardize to ID-based format
- Pros: Predictable, ID-based system
- Cons: Would change all existing internal numbers

**Recommendation**: **Keep current numbers** unless there's a business requirement to match IDs. The current numbers are already in use and changing them could break references in external systems, documents, or integrations.

If you do want to standardize, the SQL script is ready:
```sql
-- Run: scripts/standardize-internal-numbers.sql
UPDATE counteragents 
SET internal_number = 'ICE' || LPAD(id::text, 6, '0')
WHERE internal_number IS NULL 
   OR internal_number != 'ICE' || LPAD(id::text, 6, '0');
```

---

## 📋 Summary & Next Steps

### Priority 1 (Critical): NBG Rates Cron Job
- [ ] Generate CRON_SECRET
- [ ] Add CRON_SECRET to Vercel
- [ ] Deploy vercel.json changes
- [ ] Manually update rates now
- [ ] Verify cron runs tonight at 19:00 UTC

### Priority 2 (Low): Internal Numbers
- [ ] Decide: Keep current format or standardize?
- [ ] If standardizing: Run SQL script
- [ ] If keeping: Document that numbers are sequential, not ID-based

### Priority 3 (Completed): Duplicate IDs
- [x] No duplicates found
- [x] Backend error handling in place
- [x] Frontend validation working

---

## 📊 Database Statistics

- **Counteragents**: 3,283 records
- **NBG Rates**: 5,431 rates (from 2011-01-01 to 2025-11-13)
- **Countries**: ~200+ (from previous data)
- **Entity Types**: ~40+ types

---

## 🔗 Useful Commands

**Check duplicates**:
```bash
node scripts/check-duplicates.js
```

**Check NBG rates**:
```bash
node scripts/check-nbg-rates.js
```

**Check internal numbers**:
```bash
node scripts/check-internal-numbers.js
```

**Test NBG cron endpoint** (after setting CRON_SECRET):
```bash
$env:CRON_SECRET = "your-secret"
.\scripts\test-nbg-cron.ps1 https://iceerpgeorgia.com
```
