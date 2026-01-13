# BOG GEL Bank Statement Processing - Quick Start Guide

## Overview
The `import_bank_xml_data.py` script provides a comprehensive solution for processing BOG (Bank of Georgia) GEL account XML statements with intelligent counteragent matching, parsing rules, and payment ID correlation.

## Prerequisites
- Python 3.7+
- PostgreSQL databases (LOCAL and/or Supabase)
- `.env.local` file with database credentials
- Required Python packages: `psycopg2`, `uuid`, `re`, `decimal`

## Modes of Operation

### Mode 1: Import XML File
Parse a new BOG XML statement and process all transactions.

```bash
python import_bank_xml_data.py import path/to/statement.xml
```

**What it does**:
1. Parses XML file and extracts all DETAIL records
2. Generates UUIDs from DocKey + EntriesId
3. Checks for duplicates (skips if exists)
4. Inserts raw data into Supabase `bog_gel_raw_*` table
5. Applies three-phase processing (Counteragent → Rules → Payment)
6. Inserts consolidated records into LOCAL `consolidated_bank_accounts`
7. Updates processing flags in Supabase raw table

**Output**:
- Raw data in Supabase (for auditing)
- Processed data in LOCAL (for reporting)
- Detailed logs with timing and statistics

---

### Mode 2: Backparse Existing Data
Reprocess existing raw data without importing XML.

```bash
# Backparse all records for a specific account
python import_bank_xml_data.py backparse --account-uuid <uuid>

# Backparse all records with a specific batch ID
python import_bank_xml_data.py backparse --batch-id <batch_id>

# Clear consolidated data first, then backparse
python import_bank_xml_data.py backparse --account-uuid <uuid> --clear
```

**What it does**:
1. Loads raw data from LOCAL `bog_gel_raw_*` table
2. Resets processing flags (counteragent_processed, parsing_rule_processed, payment_id_processed)
3. Applies three-phase processing (same as import mode)
4. Inserts/updates consolidated records in LOCAL `consolidated_bank_accounts`
5. Updates processing flags in LOCAL raw table

**Use cases**:
- Reprocess after adding new counteragents
- Apply updated parsing rules
- Fix processing errors
- Test changes without re-importing XML

---

## Three-Phase Processing Hierarchy

### Phase 1: Counteragent Identification (HIGHEST PRIORITY)
**Cannot be overridden by later phases**

1. Extract INN from raw data based on transaction direction:
   - Incoming (debit=NULL): Use `DocSenderInn`
   - Outgoing (debit>0): Use `DocBenefInn`
2. Normalize INN (prepend '0' if 10 digits)
3. Query `counteragents` table by INN
4. Extract counteragent account:
   - **Priority 1**: `DocCorAcct` (correspondent account from bank statement)
   - **Fallback**: Direction-specific account (`DocSenderAcctNo` or `DocBenefAcctNo`)

**Result**: Sets `counteragent_uuid`, `counteragent_account_number`, `counteragent_inn`, `counteragent_processed=TRUE`

**Cases**:
- **CASE 1**: INN found + counteragent exists → `counteragent_processed=TRUE`
- **CASE 2**: INN found but no counteragent → `counteragent_processed=FALSE`, `counteragent_inn` stored
- **CASE 3**: No INN in raw data → `counteragent_processed=FALSE`, proceed to Phase 2

---

### Phase 2: Parsing Rules Application (SECOND PRIORITY)

1. Query `parsing_scheme_rules` table for active rules
2. Match rules based on `column_name` + `condition` (e.g., `DocProdGroup='COM'`)
3. Check for conflicts:
   - If rule suggests different counteragent than Phase 1 → **KEEP Phase 1**, flag conflict
4. Apply rule parameters (only if not conflicting):
   - `project_uuid`
   - `financial_code_uuid`
   - `nominal_currency_uuid`

**Result**: Sets `parsing_rule_processed=TRUE` if rule matched (or no rules apply)

**Conflict Resolution**: Counteragent from Phase 1 always wins, but other parameters can be applied.

---

### Phase 3: Payment ID Matching (LOWEST PRIORITY)

1. Extract `payment_id` from `DocInformation` field using 4 strategies:
   - Strategy 1: "payment_id: 12345" or "payment id: 12345"
   - Strategy 2: "ID: 12345" at start of string
   - Strategy 3: "#12345" or "№12345"
   - Strategy 4: Alphanumeric 5-20 chars (e.g., "PMT-2024-001")
2. Query `payments` table by `payment_id`
3. Check for conflicts:
   - If payment suggests different counteragent than Phase 1 → **KEEP Phase 1**, flag conflict
4. Apply payment parameters (only if not set by Phase 2):
   - `project_uuid`
   - `financial_code_uuid`
   - `nominal_currency_uuid`

**Result**: Sets `payment_id_processed=TRUE` if payment matched (or no payment_id found)

**Conflict Resolution**: Counteragent from Phase 1 always wins, other parameters applied only if not set by Phase 2.

---

## Processing Flags

Each raw record has three processing flags:

- `counteragent_processed`: Counteragent identified from INN (Phase 1)
- `parsing_rule_processed`: Matched against parsing scheme rules (Phase 2)
- `payment_id_processed`: Matched against payment_id (Phase 3)
- `is_processed`: Derived flag (TRUE when all three phases complete)

**Fully Processed**: `is_processed=TRUE` means all three flags are TRUE.

---

## Performance Features

### Batch Operations
- **INSERT**: Uses `executemany()` for bulk inserts (1000 records at a time)
- **UPDATE**: Uses `executemany()` for bulk updates (1000 records at a time)
- **Transactions**: All operations wrapped in database transactions

### Progress Reporting
```
📊 Processing Records:
   - Total: 10,000 records
   - Processed: 5,000 (50.0%)
   - Speed: 125.3 records/sec
   - ETA: 00:00:40
```

### Step Timing
```
🔍 [STEP] Loading dictionaries...
   ├─ Loaded 3,158 counteragents
   ├─ Loaded 2 parsing rules
   ├─ Loaded 4,227 payments
   └─ Completed in 1.23s
```

---

## Database Tables

### Supabase (Remote)
- `bog_gel_raw_current`: Raw transaction data with processing flags
- Purpose: Audit trail and source of truth

### LOCAL (PostgreSQL)
- `bog_gel_raw_current`: Same schema as Supabase (for backparse mode)
- `consolidated_bank_accounts`: Processed transactions with all enrichment
- `counteragents`: INN → counteragent mapping
- `parsing_scheme_rules`: Column-based matching rules
- `payments`: Payment ID → parameters mapping

---

## Example Workflows

### Workflow 1: Import New XML Statement
```bash
# Step 1: Import XML
python import_bank_xml_data.py import statements/2024-01-statement.xml

# Output:
# ✅ Identified account: BOG GEL Current (GE12TB0000000123456)
# 📄 Processing XML file: statements/2024-01-statement.xml
# 🔍 [STEP] Loading dictionaries... (1.23s)
# 📊 Found 1,500 DETAIL records in XML
# 🔍 [STEP] Inserting raw data to Supabase... (2.45s)
# 🔍 [STEP] Three-phase processing... (5.67s)
# 🔍 [STEP] Inserting to consolidated... (1.89s)
# 🔍 [STEP] Updating raw table flags... (1.12s)
# ✅ Successfully processed 1,500 records
```

### Workflow 2: Add Counteragent and Reprocess
```bash
# Step 1: Add missing counteragent to database
psql -d your_database -c "INSERT INTO counteragents (uuid, name, inn) VALUES (...)"

# Step 2: Backparse to reprocess records with new counteragent
python import_bank_xml_data.py backparse --account-uuid <uuid>

# Output:
# 🔄 BACKPARSE MODE: Reprocessing existing raw data
# 🔍 [STEP] Loading dictionaries... (1.23s)
# 🔍 [STEP] Loading raw records... (0.89s)
# 📊 Found 1,500 unprocessed records
# 🔍 [STEP] Processing records... (4.56s)
# ✅ Newly matched: 45 counteragents
```

### Workflow 3: Clear and Reprocess
```bash
# Clear all consolidated data for an account and reprocess
python import_bank_xml_data.py backparse --account-uuid <uuid> --clear

# Output:
# ⚠️  CLEAR mode: Deleting existing consolidated records...
# 🗑️  Deleted 1,500 records
# 🔄 BACKPARSE MODE: Reprocessing existing raw data
# ...
```

---

## Troubleshooting

### Issue 1: Scientific Notation in Account Numbers
**Symptom**: Account numbers like `1234567890123456789` appear as `1.23e+18`

**Solution**: ✅ Fixed in current implementation
- Account numbers are cast to `str()` before processing
- Priority given to `DocCorAcct` (most reliable source)
- All accounts use `.strip()` to remove whitespace

### Issue 2: Parsing Rules Not Working
**Symptom**: `parsing_rule_processed=FALSE` for all records

**Solution**: ✅ Fixed in current implementation
- Parsing rules use dynamic field matching (field_map dictionary)
- Rules must have proper `column_name` and `condition` values
- Check rules: `SELECT * FROM parsing_scheme_rules WHERE is_active = TRUE`

### Issue 3: Payment ID Not Found
**Symptom**: `payment_id_processed=FALSE` even though payment ID exists in `DocInformation`

**Solution**: ✅ Fixed in current implementation
- 4 extraction strategies (from most to least specific)
- Check `DocInformation` field for payment ID format
- Test extraction: `python -c "from import_bank_xml_data import extract_payment_id; print(extract_payment_id('your text here'))"`

### Issue 4: Duplicate Records
**Symptom**: Import fails with "duplicate key value violates unique constraint"

**Solution**: Script automatically detects duplicates
- Checks `DocKey + EntriesId` combination before insert
- Skips duplicates and reports count
- Use `--clear` in backparse mode to reset if needed

---

## Statistics and Reporting

After processing, the script displays comprehensive statistics:

```
📊 Processing Statistics:
   ├─ Total records: 1,500
   ├─ CASE 1 (Counteragent matched): 1,200 (80.0%)
   ├─ CASE 2 (INN found, no counteragent): 250 (16.7%)
   ├─ CASE 3 (No INN, needs rules/payment): 50 (3.3%)
   ├─ Parsing rules matched: 300 (20.0%)
   ├─ Payment IDs matched: 150 (10.0%)
   ├─ Fully processed: 1,450 (96.7%)
   └─ Needs attention: 50 (3.3%)

⚠️  Missing Counteragents (top 10):
   1. INN 0123456789: 45 occurrences
   2. INN 0987654321: 32 occurrences
   ...
```

---

## Validation

### Test Suite
Run the test suite to verify account extraction logic:

```bash
python test_account_extraction.py
```

Expected output:
```
🧪 Testing Account Extraction Logic
================================================================================
📝 Case 1: DocCorAcct available (incoming)                    ✅ PASS
📝 Case 2: DocCorAcct available (outgoing)                    ✅ PASS
📝 Case 3: No DocCorAcct, use DocSenderAcctNo (incoming)      ✅ PASS
📝 Case 4: No DocCorAcct, use DocBenefAcctNo (outgoing)       ✅ PASS
📝 Case 5: DocCorAcct empty string, use fallback (incoming)   ✅ PASS
📝 Case 6: No accounts available                              ✅ PASS
📝 Case 7: Scientific notation prevention (long IBAN)         ✅ PASS
================================================================================
📊 Test Results: 7 passed, 0 failed
🎉 All tests passed! Logic matches JavaScript implementation.
```

### Comparison with JavaScript
Review the detailed comparison document:

```bash
cat COMPARISON_JS_VS_PYTHON.md
```

---

## Best Practices

1. **Always backup before bulk operations**:
   ```bash
   pg_dump -d your_database -t consolidated_bank_accounts > backup.sql
   ```

2. **Test with small dataset first**:
   - Import single XML file
   - Verify results in consolidated table
   - Check processing flags

3. **Monitor missing counteragents**:
   - Review statistics output
   - Add missing counteragents to database
   - Rerun backparse to enrich records

4. **Use backparse for testing**:
   - Backparse doesn't affect Supabase
   - Safe to run multiple times
   - Use `--clear` to reset and reprocess

5. **Check logs for conflicts**:
   - Look for "⚠️  Payment suggests different counteragent"
   - Investigate why payment/rule conflicts with INN-based counteragent
   - Update database to resolve conflicts

---

## Support

For issues or questions:
1. Check [COMPARISON_JS_VS_PYTHON.md](COMPARISON_JS_VS_PYTHON.md) for implementation details
2. Run test suite: `python test_account_extraction.py`
3. Review [AGENTS.md](AGENTS.md) for architecture documentation
4. Check database schema for column mismatches

---

## Change Log

### v1.0 (Current)
- ✅ Aligned with working JavaScript implementation
- ✅ Three-phase processing hierarchy
- ✅ Batch operations with performance optimization
- ✅ Detailed logging and progress reporting
- ✅ Conflict detection and resolution
- ✅ Scientific notation prevention
- ✅ Dynamic parsing rules matching
- ✅ 4-strategy payment ID extraction
- ✅ LOCAL database autonomy for backparse mode
- ✅ Test suite validation (7/7 tests passing)
