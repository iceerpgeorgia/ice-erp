# Bank Account Parsing Rules System

## Overview
This system allows conditional override of default parsing schemes based on raw data content.

## Database Schema

### 1. **parsing_schemes** table
Stores available parsing schemes that can be applied to bank accounts.

```sql
- id: BIGSERIAL PRIMARY KEY
- name: VARCHAR(100) UNIQUE (e.g., 'BOG_GEL', 'TBC_USD')
- description: TEXT
- is_active: BOOLEAN DEFAULT true
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 2. **bank_accounts** table (UPDATE)
Add column to link accounts to parsing schemes.

```sql
- parsing_scheme_id: BIGINT REFERENCES parsing_schemes(id)
```

### 3. **bank_accounts_parsing_rules** table
Rules that override default parsing based on conditions.

```sql
- id: BIGSERIAL PRIMARY KEY
- parsing_scheme_id: BIGINT REFERENCES parsing_schemes(id)
- column_name: VARCHAR(100) -- Raw data column to check
- condition_operator: VARCHAR(50) -- Comparison operator
- condition_value: TEXT -- Value to compare against
- payment_id: VARCHAR(255) -- Payment ID to use if match
- priority: INTEGER DEFAULT 0 -- Rule evaluation order (lower = higher priority)
- is_active: BOOLEAN DEFAULT true
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Condition Operators

### Text Operators:
- `equals` - Exact match (case-sensitive)
- `equals_ignore_case` - Exact match (case-insensitive)
- `contains` - Contains substring
- `starts_with` - Starts with prefix
- `ends_with` - Ends with suffix
- `regex_match` - Matches regex pattern

### Numeric Operators:
- `greater_than` - Value > condition_value
- `less_than` - Value < condition_value
- `greater_than_or_equal` - Value >= condition_value
- `less_than_or_equal` - Value <= condition_value

### Null/Empty Operators:
- `is_null` - Value is NULL
- `is_not_null` - Value is not NULL
- `is_empty` - Value is empty string
- `is_not_empty` - Value is not empty

### Negation:
- `not_equals` - Does not equal
- `not_contains` - Does not contain

## Rule Processing Logic

1. Load all active rules for the parsing scheme, ordered by priority (ASC)
2. For each raw data row:
   a. Evaluate rules in priority order
   b. Check if the specified column exists in raw data
   c. Apply the condition operator
   d. If condition matches:
      - Load payment data for the payment_id
      - Override parsed values with payment's:
        * counteragent_uuid
        * project_uuid
        * financial_code_uuid
      - Stop rule evaluation (first match wins)
   e. If no rules match, use default parsing logic

3. Continue with standard import process

## Example Use Cases

### Example 1: Salary Payments
```
parsing_scheme_id: BOG_GEL
column_name: description
condition_operator: contains
condition_value: "ხელფასი"
payment_id: "SAL_001"
priority: 10
```
If description contains "ხელფასი", use SAL_001's counteragent/project/financial_code.

### Example 2: Specific Vendor
```
parsing_scheme_id: BOG_GEL
column_name: counteragent_account_number
condition_operator: equals
condition_value: "GE12TB1234567890123456"
payment_id: "VENDOR_XYZ"
priority: 5
```
If account number matches exactly, use VENDOR_XYZ's metadata.

### Example 3: Large Transactions
```
parsing_scheme_id: BOG_GEL
column_name: account_currency_amount
condition_operator: greater_than
condition_value: "50000"
payment_id: "LARGE_TX_DEFAULT"
priority: 100
```
Amounts > 50,000 use LARGE_TX_DEFAULT metadata.

## API Endpoints

### GET /api/parsing-schemes
List all parsing schemes

### POST /api/parsing-schemes
Create new parsing scheme

### GET /api/parsing-rules?parsing_scheme_id={id}
List rules for a scheme

### POST /api/parsing-rules
Create new rule

### PUT /api/parsing-rules/{id}
Update rule

### DELETE /api/parsing-rules/{id}
Delete rule

### PUT /api/parsing-rules/{id}/priority
Reorder rule priority

## UI Components

### Parsing Rules Manager
- Dropdown: Select parsing scheme
- Table: Display rules with:
  * Column name
  * Operator (human-readable)
  * Condition value
  * Payment ID
  * Priority (drag-to-reorder)
  * Active toggle
  * Edit/Delete buttons
- Button: Add New Rule
- Modal: Rule editor with:
  * Column name dropdown (from raw data schema)
  * Operator dropdown (filtered by column type)
  * Value input (with validation)
  * Payment ID search/autocomplete
  * Priority number input
  * Active checkbox

## Migration Plan

1. Create `parsing_schemes` table
2. Insert initial scheme: BOG_GEL
3. Add `parsing_scheme_id` to `bank_accounts` table
4. Update existing BOG accounts to use BOG_GEL scheme
5. Create `bank_accounts_parsing_rules` table
6. Implement rule evaluation logic in import process
7. Create API endpoints
8. Build UI for rule management
