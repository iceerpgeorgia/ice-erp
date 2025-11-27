# NBG Exchange Rates Import

This script fetches and imports exchange rates from the National Bank of Georgia (NBG) API.

## Features

- ✅ Fetches official exchange rates from NBG API
- ✅ Supports 8 major currencies: USD, EUR, CNY, GBP, RUB, TRY, AED, KZT
- ✅ Backfill missing dates
- ✅ Automatic daily imports via GitHub Actions
- ✅ Handles weekends and holidays gracefully

## Usage

### Import Today's Rates
```bash
npm run import:nbg-rates
```

### Backfill Missing Dates
```bash
npm run import:nbg-rates:backfill
```

### Manual Script Execution
```bash
node scripts/import_nbg_rates.js today      # Import today's rates
node scripts/import_nbg_rates.js backfill   # Backfill missing dates
```

## Automated Daily Import

The script runs automatically every day at **19:00 Tbilisi time** (15:00 UTC) via GitHub Actions.

See: `.github/workflows/import-nbg-rates.yml`

## Database Schema

```sql
CREATE TABLE nbg_exchange_rates (
  id         BIGSERIAL PRIMARY KEY,
  uuid       UUID UNIQUE DEFAULT gen_random_uuid(),
  date       DATE UNIQUE NOT NULL,
  usd_rate   DECIMAL(18, 6),
  eur_rate   DECIMAL(18, 6),
  cny_rate   DECIMAL(18, 6),
  gbp_rate   DECIMAL(18, 6),
  rub_rate   DECIMAL(18, 6),
  try_rate   DECIMAL(18, 6),
  aed_rate   DECIMAL(18, 6),
  kzt_rate   DECIMAL(18, 6),
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);
```

## API Source

- **Endpoint**: https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/
- **Documentation**: https://nbg.gov.ge/en/monetary-policy/currency

## Notes

- Rates are published by NBG typically around 17:00-18:00 Tbilisi time on business days
- Weekend and holiday dates will not have data available from the API
- The script automatically skips dates with no data
- Historical data is available from 2011-01-01 onwards
