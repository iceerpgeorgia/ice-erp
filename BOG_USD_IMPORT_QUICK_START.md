# BOG USD Import - Quick Start

## ⚡ 60-Second Import Process

### Step 1: Open Supabase
```
https://app.supabase.com/project/fojbzghphznbslqwurrm/sql/new
```

### Step 2: Load SQL File
- Open file: `_bog_usd_import.sql` (2.31 MB)
- Copy all content (Ctrl+A, Ctrl+C)

### Step 3: Paste & Execute
- Paste into Supabase SQL Editor (Ctrl+V)
- Click blue "Run" button
- Wait 3-5 minutes

### Step 4: Verify
```sql
-- Total rows should show 3,660 more than before
SELECT COUNT(*) FROM "GE78BG0000000893486000_BOG_USD";

-- Date range should be 2018-01-12 to 2022-04-18
SELECT MIN(transaction_date), MAX(transaction_date) 
FROM "GE78BG0000000893486000_BOG_USD" 
WHERE transaction_date IS NOT NULL;
```

---

## 📊 What's Being Imported

| Metric | Value |
|--------|-------|
| Transactions | 3,660 |
| Date Range | 2018-01-12 to 2022-04-18 |
| Columns | 26 |
| File Size | 2.31 MB |
| Duplicate Key | `operation_id` (all unique) |

---

## ✅ Duplicate Protection

The script includes automatic deduplication:
```sql
ON CONFLICT (operation_id) DO NOTHING
```

**Safe to run multiple times** - duplicates are automatically skipped.

---

## 🛠️ Alternative: Command Line Import

```bash
# Set password
export PGPASSWORD="[password]"

# Run import
psql -h db.fojbzghphznbslqwurrm.supabase.co -U postgres -d postgres -f _bog_usd_import.sql
```

---

## 📁 Files Provided

1. **`_bog_usd_import.sql`** - Main import script (use this!)
2. **`BOG_USD_IMPORT_GUIDE.md`** - Detailed documentation
3. **`_generate_bog_usd_sql.py`** - Script that generated SQL
4. **`_check_bog_usd_excel.py`** - Excel analysis tool

---

## ⚠️ Important Notes

- ✅ All 3,660 operation IDs are unique
- ✅ Document numbers have duplicates (normal for loans)
- ✅ NULL values are expected for missing fields
- ✅ Georgian characters are preserved in UTF-8
- ✅ Safe to re-run (idempotent import)

---

## 🚀 What Happens Next

1. Import completes in 3-5 minutes
2. 3,660 new transactions appear in database
3. Payments report will include 2018-2022 data
4. Date range extends from previous cutoff to 2022-04-18
5. No data is overwritten or deleted

---

## 📞 Need Help?

- Check `BOG_USD_IMPORT_GUIDE.md` for detailed instructions
- Review `_bog_usd_import.sql` for exact transformations
- Original Excel: `Chrome Logs\BOG USD 2018-2022.xlsx`
- Target table: `GE78BG0000000893486000_BOG_USD`

---

**Ready to import? Copy `_bog_usd_import.sql` content and paste into Supabase SQL Editor!**
