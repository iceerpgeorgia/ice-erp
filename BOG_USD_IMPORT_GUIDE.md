# BOG USD Transaction Import - Complete Guide

## Summary

Successfully analyzed and prepared **3,660 BOG USD bank transactions** (2018-2022) for import into the `GE78BG0000000893486000_BOG_USD` database table.

### Key Findings

- **Total Transactions**: 3,660 rows
- **Date Range**: 2018-01-12 to 2022-04-18 (1,557 days)
- **Unique Transactions**: 3,660 unique Operation IDs (100% unique)
- **Duplicate Key**: Document numbers have 466 duplicates (normal for loan operations)
- **Recommended Dedup Key**: `operation_id` (ოპერაციის იდ)

### Transaction Breakdown by Year

| Year | Transactions | % of Total |
|------|-------------|-----------|
| 2018 | 606 | 16.5% |
| 2019 | 704 | 19.2% |
| 2020 | 925 | 25.3% |
| 2021 | 1,142 | 31.2% |
| 2022 | 283 | 7.7% |

## Generated Assets

### 1. SQL Import Script
**File**: `_bog_usd_import.sql` (2.31 MB)
- Contains 3,660 INSERT statements
- All 26 database columns mapped
- Includes deduplication logic: `ON CONFLICT (operation_id) DO NOTHING`
- Ready for direct execution on Supabase

### 2. Column Mapping (Excel → Database)

| Database Column | Excel Column (Georgian) | Data Type | Sample Value |
|-----------------|------------------------|-----------|--------------|
| transaction_date | თარიღი | DATE | 2018-01-12 |
| document_number | საბუთის N | TEXT | '1801121330000048' |
| operation_id | ოპერაციის იდ | INTEGER | 22705799177 |
| debit_amount | დებეტი | NUMERIC | 7000.0 |
| credit_amount | კრედიტი | NUMERIC | 7025.15 |
| amount | თანხა | NUMERIC | -7000.0 |
| operation_description | ოპერაციის შინაარსი | TEXT | 'INVOICE 17GEO-003ZD' |
| purpose | დანიშნულება | TEXT | 'INVOICE 17GEO-003ZD' |
| sender_name | გამგზავნის დასახელება | TEXT | 'SHANGHAI MITSUBISHI ELEVATOR CO LTD' |
| beneficiary_name | მიმღების დასახელება | TEXT | 'SHANGHAI MITSUBISHI ELEVATOR CO LTD' |
| sender_inn | გამგზავნის საიდენტიფიკაციო კოდი | NUMERIC | 400017245 |
| beneficiary_inn | მიმღების საიდენტიფიკაციო კოდი | NUMERIC | NULL |
| *and 14 more columns...* | | | |

## Import Instructions

### Method 1: Supabase Web Console (Recommended)

1. **Open Supabase Console**
   - URL: https://app.supabase.com/project/fojbzghphznbslqwurrm/sql/new
   - Login with your Supabase credentials

2. **Copy SQL Script**
   - Open `_bog_usd_import.sql` in a text editor
   - Select all content (Ctrl+A)
   - Copy to clipboard (Ctrl+C)

3. **Execute Import**
   - Paste into the Supabase SQL Editor
   - Click the blue "Run" button
   - Wait for completion (3-5 minutes for 3,660 rows)

4. **Verify Import**
   ```sql
   -- Check total row count
   SELECT COUNT(*) as total_rows FROM "GE78BG0000000893486000_BOG_USD";
   
   -- Check date range
   SELECT 
     MIN(transaction_date) as earliest_date,
     MAX(transaction_date) as latest_date,
     COUNT(*) as row_count
   FROM "GE78BG0000000893486000_BOG_USD"
   WHERE transaction_date IS NOT NULL;
   
   -- Check for duplicates (should be 0)
   SELECT 
     operation_id,
     COUNT(*) as occurrences
   FROM "GE78BG0000000893486000_BOG_USD"
   WHERE operation_id IS NOT NULL
   GROUP BY operation_id
   HAVING COUNT(*) > 1;
   ```

### Method 2: Command Line (psql)

```bash
# Set password in environment
export PGPASSWORD="[your_password]"

# Run import
psql \
  -h db.fojbzghphznbslqwurrm.supabase.co \
  -U postgres \
  -d postgres \
  -f _bog_usd_import.sql

# Verify
psql \
  -h db.fojbzghphznbslqwurrm.supabase.co \
  -U postgres \
  -d postgres \
  -c "SELECT COUNT(*) FROM \"GE78BG0000000893486000_BOG_USD\";"
```

### Method 3: Using Docker

```bash
# With Docker running Postgres
docker exec postgres-container psql -U postgres -d postgres -f _bog_usd_import.sql
```

## Deduplication Strategy

### Why Operation ID is Optimal

```
Analysis Results:
├── Document Number ('საბუთის N')
│   ├── Total unique: 1,024 / 3,660 (28%)
│   ├── Duplicates: 466 values appearing multiple times
│   ├── Example: '6012564' appears 672 times
│   └── Status: NOT SUITABLE (too many duplicates)
│
├── Operation ID ('ოპერაციის იდ')
│   ├── Total unique: 3,660 / 3,660 (100%)
│   ├── Duplicates: NONE
│   └── Status: ✓ OPTIMAL CHOICE
│
└── Reference ('Ref')
    ├── Total unique: 3,618 / 3,660 (98%)
    ├── Duplicates: 40 values appearing multiple times
    └── Status: ACCEPTABLE but Operation ID is better
```

### Why Duplicates Exist in Document Numbers

The duplicates in Document # are **legitimate bank transactions**, not data errors:
- Loan document with multiple related transactions
  - Transaction 1: Loan disbursement (credit +600,000)
  - Transaction 2: Loan initiation fee (debit -3,000)
  - Transaction 3: Interest payment (debit -500)
  - etc.

The `ON CONFLICT (operation_id) DO NOTHING` clause ensures:
- Each unique operation is imported only once
- Duplicate imports are automatically skipped
- Safe for re-running the script (idempotent)

## Data Quality Notes

### NULL Values (Expected)

```
Column                          NULLs    % of Total
────────────────────────────────────────────────
კრედიტი (credit_amount)        2,926    79.9%  ← Debit transactions
დებეტი (debit_amount)            734    20.1%  ← Credit transactions
მიმღების საიდენტიფიკაციო კოდი     1,425    38.9% ← External transfers
გამგზავნი ბანკის კოდი              391    10.7% ← Domestic transfers
```

NULL values are normal for bank data:
- Either debit OR credit amount present (not both)
- Beneficiary info missing for outgoing transfers
- Bank codes may not be populated

### Data Type Conversions

| Excel Format | SQL Type | Notes |
|-------------|----------|-------|
| XLSX Number (date serial) | DATE | Converted: 43112 → 2018-01-12 |
| XLSX Number (float) | NUMERIC | Preserved with decimal places |
| XLSX Text | TEXT | UTF-8 Georgian characters preserved |
| XLSX Empty/NA | NULL | Handled correctly |

## File Structure

```
_bog_usd_import.sql
├── Header Comments (lines 1-4)
├── INSERT Statements (lines 5-10981)
│   ├── Column list (26 columns)
│   ├── 3,660 VALUES rows
│   └── ON CONFLICT clause
└── Summary Comments
```

### Sample Row from Generated SQL

```sql
INSERT INTO "GE78BG0000000893486000_BOG_USD" (
  "transaction_date", "document_number", "correspondent_account",
  "debit_amount", "credit_amount", "exchange_rate", 
  "debit_gel", "credit_gel", "operation_description",
  "operation_type", "operation_id", "ref",
  "sender_name", "sender_inn", "sender_account",
  "sender_bank_code", "sender_bank_name",
  "beneficiary_name", "beneficiary_inn", "beneficiary_account",
  "beneficiary_bank_code", "beneficiary_bank_name",
  "purpose", "additional_info", "amount", "amount_gel"
)
VALUES
  ('2018-01-12', '1801121330000048', '26118401330100000000',
   NULL, 7025.15, 2.5671,
   NULL, 18034.26, 'ვალუტის გაცვლითი ოპერაცია. კურსი:1.205...',
   'CCO', 22705799177, 6200248563,
   'შპს  "აი-სი-ი "', 400017245, 'GE78BG0000000893486000USD',
   'BAGAGE22', 'სს "საქართველოს ბანკი"',
   'შპს  "აი-სი-ი "', 400017245, 'GE78BG0000000893486000EUR',
   'BAGAGE22', 'სს "საქართველოს ბანკი"',
   'კონვერტაცია', 'კონვერტაცია', 7025.15, 18034.26),
  ...
ON CONFLICT (operation_id) DO NOTHING;
```

## Expected Import Results

### Before Import
```
SELECT COUNT(*) FROM "GE78BG0000000893486000_BOG_USD";
→ [current row count]
```

### After Import
```
SELECT COUNT(*) FROM "GE78BG0000000893486000_BOG_USD";
→ [current row count + 3,660 - any pre-existing duplicates]

SELECT 
  COUNT(DISTINCT operation_id) as unique_operations,
  COUNT(*) as total_rows
FROM "GE78BG0000000893486000_BOG_USD";
→ All new operations will be unique
```

## Troubleshooting

### Issue: "Duplicate key value violates unique constraint"
- **Cause**: Some operation IDs already exist in database
- **Resolution**: The SQL script handles this automatically with `ON CONFLICT ... DO NOTHING`
- **Action**: No action needed, duplicates are skipped safely

### Issue: "Invalid date format"
- **Cause**: Excel date serial numbers not converted correctly
- **Resolution**: Script converts Excel format (days since 1900-01-01) to standard SQL dates
- **Action**: Verify dates are in range 2018-01-12 to 2022-04-18

### Issue: "Georgian characters showing as ???"
- **Cause**: Encoding issue
- **Resolution**: SQL script uses UTF-8 encoding (standard for Supabase)
- **Action**: Verify Supabase connection uses UTF-8

### Issue: "Transaction timed out"
- **Cause**: Query too large for single execution (rare)
- **Resolution**: Split into smaller batches
- **Action**: Use `LIMIT` clauses to run in chunks

## Files Generated

| File | Size | Purpose |
|------|------|---------|
| `_bog_usd_import.sql` | 2.31 MB | SQL import script (3,660 rows) |
| `_generate_bog_usd_sql.py` | 6.2 KB | Python script that generated the SQL |
| `_check_bog_usd_excel.py` | 4.1 KB | Excel analysis script |
| `_check_db_vs_excel.py` | 3.5 KB | Database vs Excel comparison |
| `BOG_USD_IMPORT_GUIDE.md` | This file | Complete import documentation |

## Next Steps

1. **Immediate**: Execute `_bog_usd_import.sql` on Supabase
   - Use Web Console (easiest)
   - Or use psql command line

2. **Verify**: Run validation SQL queries
   - Check row count
   - Check date range
   - Check for duplicates

3. **Document**: Update deployment log
   - Record import date
   - Document row count
   - Note any issues

4. **Monitor**: Watch for any application issues
   - UI should reflect new transactions
   - Reports should include 2018-2022 data
   - Payment matching may change

## Contact & Support

For questions about this import:
- Check the SQL script for exact data transformations
- Review Excel file: `Chrome Logs\BOG USD 2018-2022.xlsx`
- Refer to database table: `GE78BG0000000893486000_BOG_USD`

---

**Generated**: 2024-06-24 | **Source**: `Chrome Logs\BOG USD 2018-2022.xlsx` | **Target**: `GE78BG0000000893486000_BOG_USD`
