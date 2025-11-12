# NBG Rates to Google Sheets Sync Script

## Overview

This script synchronizes NBG (National Bank of Georgia) exchange rates from your Supabase database to a Google Sheets spreadsheet. It supports:

- **Direct rates**: e.g., `USD/GEL` (how much GEL is 1 USD) - fetched directly from NBG data
- **Inverse rates**: e.g., `GEL/USD` (how much USD is 1 GEL) - calculated as 1/rate
- **Cross rates**: e.g., `EUR/USD` (how much USD is 1 EUR) - calculated as rate_eur/rate_usd

## Features

- Automatically identifies missing dates in the spreadsheet
- Calculates any currency pair combination from NBG rates
- Supports 8 foreign currencies: USD, EUR, CNY, GBP, RUB, TRY, AED, KZT
- Formats dates as dd.mm.yyyy
- Sorts sheet by date after insertion
- Handles weekends and holidays (uses previous day's rates)

## Prerequisites

1. **Python packages**: Install required packages
   ```bash
   pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client psycopg2-binary
   ```

2. **Google Service Account**: 
   - Your service account JSON file should be in the project root
   - Current file: `client_secret_904189547818-lsif33dip9h7dq1i34p3htppq3018k2j.apps.googleusercontent.com.json`

3. **Environment Variables**:
   - `REMOTE_DATABASE_URL`: Supabase database connection string
   - `SPREADSHEET_ID`: Google Sheets spreadsheet ID
   - `SHEET_NAME`: Name of the sheet tab (default: "NBG Rates")

## Google Sheets Setup

### Step 1: Prepare Your Spreadsheet

Create a spreadsheet with the following structure:

| Date       | USD/GEL  | GEL/USD  | EUR/GEL  | EUR/USD  | USD/EUR  | ... |
|------------|----------|----------|----------|----------|----------|-----|
| 01.01.2011 | 1.7823   | 0.561089 | 2.4561   | 1.378234 | 0.725721 | ... |
| 02.01.2011 | 1.7845   | 0.560396 | 2.4578   | 1.377234 | 0.726239 | ... |

**Important**:
- First column MUST be named "Date"
- Date format: dd.mm.yyyy (e.g., 12.11.2025)
- Headers should be in format: `CURRENCY1/CURRENCY2`
- Add any currency pairs you need (direct, inverse, or cross rates)

### Step 2: Share with Service Account

1. Get the service account email from your JSON file (field: `client_email`)
2. Share your Google Sheet with this email address
3. Give "Editor" permissions

### Step 3: Get Spreadsheet ID

From the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

## Usage

### Basic Usage

Set environment variables and run:

```bash
$env:REMOTE_DATABASE_URL = "your_supabase_connection_string"
$env:SPREADSHEET_ID = "your_spreadsheet_id"
$env:SHEET_NAME = "NBG Rates"

python scripts/sync-nbg-to-google-sheets.py
```

### One-liner with All Variables

```bash
$env:REMOTE_DATABASE_URL = "postgresql://postgres.xxx:pass@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"; $env:SPREADSHEET_ID = "1AbC123XyZ"; $env:SHEET_NAME = "NBG Rates"; python scripts/sync-nbg-to-google-sheets.py
```

## Rate Calculation Examples

### Direct Rates (X/GEL)
How much GEL is 1 unit of currency X:
```
USD/GEL → usd_rate (directly from NBG)
EUR/GEL → eur_rate (directly from NBG)
```

### Inverse Rates (GEL/X)
How much of currency X is 1 GEL:
```
GEL/USD → 1 / usd_rate
GEL/EUR → 1 / eur_rate
```

### Cross Rates (X/Y)
How much of currency Y is 1 unit of currency X:
```
EUR/USD → eur_rate / usd_rate
USD/EUR → usd_rate / eur_rate
GBP/USD → gbp_rate / usd_rate
CNY/RUB → cny_rate / rub_rate
```

## Supported Currencies

- **GEL** - Georgian Lari (base currency)
- **USD** - US Dollar
- **EUR** - Euro
- **CNY** - Chinese Yuan
- **GBP** - British Pound
- **RUB** - Russian Ruble
- **TRY** - Turkish Lira
- **AED** - UAE Dirham
- **KZT** - Kazakhstani Tenge

You can create any combination of these currencies using the `/` format.

## Example Headers

Common combinations:
```
Date | USD/GEL | GEL/USD | EUR/GEL | GEL/EUR | EUR/USD | USD/EUR | GBP/USD | RUB/USD
```

All cross rates:
```
Date | USD/EUR | USD/GBP | USD/CNY | EUR/GBP | EUR/CNY | GBP/CNY
```

## Output Example

```
======================================================================
SYNC NBG RATES TO GOOGLE SHEETS
======================================================================
Started at: 2025-11-12 15:30:00
Spreadsheet ID: 1AbC123XyZ
Sheet Name: NBG Rates

Connecting to Supabase...
✓ Connected to Supabase
Initializing Google Sheets API...
✓ Connected to Google Sheets

Reading headers from sheet 'NBG Rates'...
✓ Found 9 columns: Date, USD/GEL, GEL/USD, EUR/GEL, EUR/USD, USD/EUR, GBP/USD, RUB/USD, CNY/USD

Fetching existing dates from sheet...
✓ Found 5427 existing dates in sheet
  Date range: 2011-01-01 to 2025-11-10

Fetching NBG data from database...
✓ Database date range: 2011-01-01 to 2025-11-12

Identifying missing dates...
✓ Found 2 missing dates
  First missing: 2025-11-11
  Last missing: 2025-11-12

Fetching NBG rates for missing dates...
✓ Fetched rates for 2 dates

Building rows to insert...
✓ Built 2 rows

Inserting rows into Google Sheets...
✓ Inserted 2 rows

Sorting sheet by date...
✓ Sorted sheet by date

======================================================================
SYNC COMPLETED SUCCESSFULLY!
======================================================================
Finished at: 2025-11-12 15:30:45
Inserted 2 new rows
```

## Troubleshooting

### Error: "No headers found in sheet"
- Make sure the first row contains headers
- First column must be "Date"

### Error: "Could not calculate X/Y"
- Check that both currencies are supported
- Verify NBG data exists for that date in database

### Error: "relation 'nbg_exchange_rates' does not exist"
- Make sure you've run the Supabase sync script first
- Check REMOTE_DATABASE_URL is correct

### Rates appear as empty cells
- NBG might not have published rates for that currency on that date
- Check the database for missing data

## Automation

You can schedule this script to run daily after the Vercel cron job updates NBG rates (after 23:00 Georgian time):

```bash
# Windows Task Scheduler
# Or use a cron job on Linux/Mac
0 0 * * * cd /path/to/project && python scripts/sync-nbg-to-google-sheets.py
```

## Notes

- The script only inserts missing dates, never updates existing ones
- Dates are automatically sorted after insertion
- Cross rates are calculated with 6 decimal precision
- Weekend/holiday rates are already handled in the NBG database (gaps filled)
