# NBG Exchange Rates System

Automated system for managing National Bank of Georgia (NBG) exchange rates.

## Overview

The system maintains historical and current exchange rates from the NBG, storing how many Georgian Lari (GEL) equals 1 unit of each foreign currency.

## Database Structure

### Table: `nbg_exchange_rates`

- **id**: Primary key
- **uuid**: Unique identifier
- **date**: Exchange rate date (unique)
- **Currency columns**: `usd_rate`, `eur_rate`, `cny_rate`, `gbp_rate`, `rub_rate`, `try_rate`, `aed_rate`, `kzt_rate`
  - Type: DECIMAL(18, 6)
  - Value: How many GEL = 1 unit of currency
  - Example: `usd_rate = 2.7064` means 1 USD = 2.7064 GEL

### Logic

- **Rate Calculation**: Rate = NBG_Rate / Quantity
  - If NBG says "100 RUB = 3.3255 GEL"
  - We store: `rub_rate = 3.3255 / 100 = 0.033255`
  
- **Weekend/Holiday Filling**: Missing dates use the previous available date's rates
  - If data exists for Nov 8 (Fri) but not Nov 9-10 (Sat-Sun)
  - Nov 9 and Nov 10 will use Nov 8's rates

## Scripts

### 1. Import Historical Data

```bash
python scripts/import-nbg-historical-rates.py
```

**Purpose**: Import historical exchange rates from CSV files in `Historical NBG/` folder.

**CSV Format**:
- Columns: Code, Quantity, Rate, Diff, Name, Date, ValidFromDate
- One file per currency (USD.csv, EUR.csv, etc.)

**Features**:
- Reads all CSV files from `Historical NBG/` folder
- Calculates rate per 1 unit (Rate / Quantity)
- Fills missing dates (weekends/holidays) with previous rates
- Shows statistics and sample data

**Output**:
```
✅ Import complete!
   📊 Inserted: 5430 records
   Date range: 2011-01-01 to 2025-11-12
```

### 2. Update Current Rates

```bash
python scripts/update-nbg-rates.py
```

**Purpose**: Fetch latest exchange rates from NBG API and update database.

**API**: https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/

**Features**:
- Fetches current rates from NBG API
- Calculates rate per 1 unit
- Updates existing date or inserts new date
- Fills any missing dates since last update
- Shows warning if currencies table has currencies without columns

**Schedule**: Run daily after 18:30 Georgian time (when NBG publishes rates)

**Output**:
```
✅ Exchange rates updated successfully!
📊 Current rates in database for 2025-11-12:
  USD: 1 = 2.706400 GEL
  EUR: 1 = 3.132100 GEL
  RUB: 1 = 0.033255 GEL
```

### 3. Sync Currency Columns

```bash
python scripts/sync-currency-columns.py
```

**Purpose**: Add missing currency columns when new currencies are added to `currencies` table.

**When to Run**:
- After adding a new currency to the `currencies` table
- Before running `update-nbg-rates.py` if you get warnings

**Features**:
- Compares active currencies with existing columns
- Adds missing `{currency}_rate` columns
- Shows before/after state

**Output**:
```
✅ Added 1/1 columns successfully!
📊 Updated rate columns: 9
   AED, CNY, EUR, GBP, JPY, KZT, RUB, TRY, USD

💡 Next step: Run 'python scripts/update-nbg-rates.py' to fetch latest rates
```

## Workflow

### Initial Setup (Done ✅)

1. ✅ Created `nbg_exchange_rates` table in database
2. ✅ Added Prisma model for NBGExchangeRate
3. ✅ Imported historical data (5,430 records from 2011-2025)

### Daily Operations

1. **Automatic Rate Updates** (Should be scheduled):
   ```bash
   python scripts/update-nbg-rates.py
   ```
   - Recommended: Daily at 19:00 Georgian time
   - Via cron job, Windows Task Scheduler, or cloud scheduler

### Adding New Currencies

1. Add currency to `currencies` table:
   ```sql
   INSERT INTO currencies (code, name, is_active) 
   VALUES ('JPY', 'Japanese Yen', true);
   ```

2. Sync columns:
   ```bash
   python scripts/sync-currency-columns.py
   ```

3. Fetch rates:
   ```bash
   python scripts/update-nbg-rates.py
   ```

## Database Queries

### Get Latest Rates
```sql
SELECT date, usd_rate, eur_rate, gbp_rate, rub_rate
FROM nbg_exchange_rates
ORDER BY date DESC
LIMIT 1;
```

### Get Rate for Specific Date
```sql
SELECT usd_rate, eur_rate
FROM nbg_exchange_rates
WHERE date = '2025-11-12';
```

### Get Rate History for Currency
```sql
SELECT date, usd_rate
FROM nbg_exchange_rates
WHERE date >= '2025-11-01'
ORDER BY date DESC;
```

### Calculate Currency Conversion
```sql
-- Convert 100 USD to GEL on 2025-11-12
SELECT 100 * usd_rate as gel_amount
FROM nbg_exchange_rates
WHERE date = '2025-11-12';

-- Result: 270.64 GEL
```

## API Integration (Future)

Create API endpoint to serve exchange rates:

```typescript
// GET /api/exchange-rates?date=2025-11-12&currency=USD
// Returns: { date: "2025-11-12", currency: "USD", rate: 2.7064 }
```

## Monitoring

### Check Last Update
```sql
SELECT MAX(date) as last_update, COUNT(*) as total_records
FROM nbg_exchange_rates;
```

### Check Missing Dates
```sql
SELECT date
FROM generate_series('2025-11-01'::date, CURRENT_DATE, '1 day') AS date
WHERE date NOT IN (SELECT date FROM nbg_exchange_rates);
```

## Troubleshooting

### Problem: Script fails with "currency not found"
**Solution**: Run `sync-currency-columns.py` to add missing columns

### Problem: Rates not updating
**Solution**: 
1. Check internet connection
2. Verify NBG API is accessible
3. Check if it's a weekend/holiday (NBG doesn't publish rates)

### Problem: Historical import fails
**Solution**:
1. Verify CSV files exist in `Historical NBG/` folder
2. Check CSV format matches expected structure
3. Ensure database connection is working

## Notes

- **Weekend/Holiday Logic**: Automatically uses previous business day's rates
- **Rate Format**: Always stored as "per 1 unit" for consistency
- **Date Format**: Uses ValidFromDate from NBG (the date the rate becomes effective)
- **Precision**: DECIMAL(18, 6) provides 6 decimal places of precision
- **Currency Codes**: ISO 4217 standard (USD, EUR, GBP, etc.)

## Statistics

- **Historical Data**: 2011-01-01 to 2025-11-12
- **Total Records**: 5,430+ dates
- **Currencies Tracked**: 8 (USD, EUR, CNY, GBP, RUB, TRY, AED, KZT)
- **Update Frequency**: Daily (when NBG publishes)
- **Data Source**: National Bank of Georgia API

## Related Files

- `prisma/schema.prisma` - NBGExchangeRate model definition
- `scripts/create-nbg-rates-table.py` - Table creation script
- `scripts/import-nbg-historical-rates.py` - Historical data import
- `scripts/update-nbg-rates.py` - Daily rate updater
- `scripts/sync-currency-columns.py` - Column synchronization
- `Historical NBG/*.csv` - Historical rate data files
