# Payment Records Import Template Guide

## Column Mapping: Old System → New System

| Old Column | New System Field | Type | Required | Notes |
|---|---|---|---|---|
| ანგარიში | `account_uuid` | UUID | YES | Bank account UUID (from accounts table) |
| კონტრაგენტი GUID | `counteragent_uuid` | UUID | YES | Counteragent identifier |
| პროექტი GUID | `project_uuid` | UUID | YES | Project identifier |
| კოდი GUID | `financial_code_uuid` | UUID | YES | Financial code (income/expense) |
| ISO | `currency_code` | String (3-char) | YES | Currency code (GEL, USD, EUR, etc.) |
| ნომინალი | `amount` | Decimal | YES | Amount in the specified currency |
| USD/GEL | `usd_gel_rate` | Decimal | Optional | Exchange rate USD to GEL (informational) |
| EUR/GEL | `eur_gel_rate` | Decimal | Optional | Exchange rate EUR to GEL (informational) |
| Inc. Tax | `income_tax` | Boolean | NO | Income tax applied (true/false) |
| კომენტარი | `comment` | Text | Optional | Payment description/comment |
| დანიშნულება | `purpose` | Text | Optional | Purpose of payment |
| თარიღი | `transaction_date` | Date (DD.MM.YYYY) | YES | Transaction date |
| კორ. თარიղი | `correction_date` | Date (DD.MM.YYYY) | Optional | Correction date (if different from transaction date) |
| ოპ. ID1 | `operation_id_1` | String | Optional | Custom operation identifier 1 |
| ოპ. ID2 | `operation_id_2` | String | Optional | Custom operation identifier 2 |
| Order_ID | `order_id` | String | Optional | Order reference |
| Record_ID | `record_id` | String | Optional | Original record ID (for tracking) |
| PL | `ledger_type` | String | Optional | Ledger type: "accrual" or "order" |

## Field Details & Rules

### Required Fields (MUST be provided)
1. **account_uuid**: UUID of the bank account where transaction occurred
   - Example: `GE65TB7856036050100002`
   - Must exist in accounts table

2. **counteragent_uuid**: UUID of the counteragent (company/person)
   - Example: `B4968862-3843-414D-9E73-1A7611618B41`
   - Must exist in counteragents table

3. **project_uuid**: UUID of the project
   - Example: `CFFC1C06-B78B-45A0-8A02-37A23706EAFC`
   - Must exist in projects table

4. **financial_code_uuid**: UUID of financial code
   - Example: `B59170EC-16CC-499A-9FF7-0428DCB8F727`
   - Must exist in financial_codes table

5. **currency_code**: 3-letter currency code
   - Examples: `GEL`, `USD`, `EUR`
   - Must exist in currencies table

6. **amount**: Numeric amount
   - Format: Use decimal point (.), not comma
   - Example: `33918.59` (not `33,918.59`)
   - Can be positive or negative

7. **transaction_date**: Date of transaction
   - Format: `DD.MM.YYYY` (e.g., `05.11.2019`)

### Optional but Recommended
- **comment**: Description of the payment
- **purpose**: Business purpose
- **correction_date**: If payment needs correction date (must be different from transaction_date)
- **income_tax**: Boolean (true/false) - defaults to false

### Optional (Tracking/Reference)
- **operation_id_1**, **operation_id_2**: Custom IDs for reference
- **order_id**: Order reference number
- **record_id**: Original system record ID
- **usd_gel_rate**, **eur_gel_rate**: Exchange rates (informational only)

## Data Format Requirements

### Dates
- Format: `DD.MM.YYYY`
- Example: `05.11.2019` for November 5, 2019
- Correction date must NOT equal transaction date (if specified)

### Numbers
- Use decimal point (`.`), not comma
- Example: `33918.59` ✓
- Example: `33,918.59` ✗

### Boolean Values
- Use: `true` or `false` (lowercase)
- Or: `1` or `0`
- Or: `yes` or `no`

### UUIDs
- Format: Standard UUID v4 format
- With hyphens: `b4968862-3843-414d-9e73-1a7611618b41`
- Without hyphens: `b4968862384d414d9e731a7611618b41` (will be standardized)

## Sample Record from Your Data

```
Account:          GE65TB7856036050100002
Counteragent:     B4968862-3843-414D-9E73-1A7611618B41 (იუნიქს ქონსთრაქშენ კომპანი)
Project:          CFFC1C06-B78B-45A0-8A02-37A23706EAFC (UNIX Marselle)
Financial Code:   B59170EC-16CC-499A-9FF7-0428DCB8F727 (1.1.1. შემოსავალი ლიფტების)
Currency:         USD
Amount:           33,918.59
Transaction Date: 05.11.2019
Purpose:          ავანსი ლიფტების შესასყიდად სრ.თანხის 10% - 34000 USD @ 2.9582 rate
Recipient Acct:   GE17KS0000000360500332
Op ID1:           2594
Op ID2:           698fe5_ac_8a076d
Record ID:        fa7ff134-f253-4538-9f84-7a6586b9b975
```

## Payment Fields Interpretation

### Income Tax (`Inc. Tax`)
- If `true`: Payment subject to income tax withholding
- If `false` (default): No income tax withholding

### Ledger Type (`PL` → `ledger_type`)
- `Accrual`: Regular accrued payment
- `Order`: Payment against order/invoice
- Default: `accrual`

### Amount Sign Convention
- Positive number: Standard payment (outflow for expense, inflow for income)
- Negative number: Reversal/correction to previous payment

## Import Steps

1. **Gather UUIDs**: Ensure all referenced UUIDs exist in the database:
   - Account UUIDs
   - Counteragent UUIDs
   - Project UUIDs
   - Financial Code UUIDs

2. **Format Data**: Convert your old data using the column mapping above

3. **Validate**:
   - Check all required fields are present
   - Verify date format (DD.MM.YYYY)
   - Confirm numbers use decimal point
   - Ensure UUIDs are valid format

4. **Prepare File**: Export as CSV with:
   - Delimiter: `,` (comma)
   - Text encoding: UTF-8
   - Quote fields containing: `,` or `"` or newlines

5. **Share Template**: Provide the filled CSV file to the developer for import

## CSV Template Headers

```
account_uuid,counteragent_uuid,project_uuid,financial_code_uuid,currency_code,amount,transaction_date,correction_date,income_tax,comment,purpose,operation_id_1,operation_id_2,order_id,record_id,usd_gel_rate,eur_gel_rate
```

## Example CSV Row

```
GE65TB7856036050100002,B4968862-3843-414D-9E73-1A7611618B41,CFFC1C06-B78B-45A0-8A02-37A23706EAFC,B59170EC-16CC-499A-9FF7-0428DCB8F727,USD,33918.59,05.11.2019,,false,ავანსი ლიფტების შესასყიდად,Payment for lift procurement,2594,698fe5_ac_8a076d,,fa7ff134-f253-4538-9f84-7a6586b9b975,2.9582,3.3093
```

## Questions/Clarifications Needed

When sharing your record data, please confirm:

1. **Currency Validation**: Is `USD` the actual transaction currency, or is amount in `GEL`?
   - If USD, we need exchange rate to store nominal GEL equivalent
   
2. **Correction Date**: Why would correction date differ from transaction date?
   - This is for post-dated corrections only; usually same as transaction_date
   
3. **Exchange Rates**: Are USD/GEL and EUR/GEL rates:
   - The rates used for this specific transaction?
   - Reference rates for the date?
   - Informational only?

## Next Steps

1. **Option A**: Fill in the CSV template and share rows
2. **Option B**: Export from your old database into CSV format matching the column mapping
3. **Option C**: Share a few sample rows first for validation before bulk import
