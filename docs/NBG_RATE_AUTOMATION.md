# NBG Exchange Rate Automation

## Overview
This system automatically imports daily exchange rates from the National Bank of Georgia (NBG) API, with weekend handling and manual trigger capabilities.

## Features

### 1. Weekend Handling
- **Problem**: NBG doesn't publish rates on weekends
- **Solution**: Automatically uses Friday's rates for Saturday and Sunday
- **Backfill**: Missing weekend dates are filled with appropriate Friday rates

### 2. Automated Daily Import
- **Schedule**: Daily at 19:00 Tbilisi time (15:00 UTC)
- **Platform**: GitHub Actions workflow
- **Script**: `scripts/update-nbg-rates.py`
- **Workflow**: `.github/workflows/import-nbg-rates.yml`

### 3. Manual Trigger
- **Vercel API Endpoint**: `/api/cron/sync-nbg-rates`
- **Authentication**: Bearer token via `CRON_SECRET` environment variable
- **Timeout**: 60 seconds
- **Use Case**: Immediate rate updates when needed

## Setup Instructions

### GitHub Repository Secrets
Add the following secret in GitHub repository settings:

```
DATABASE_URL = postgresql://postgres.<project-ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
```

**Note**: Use the production Supabase database URL with connection pooling.

### Vercel Environment Variables
Add the following environment variable in Vercel project settings:

```
CRON_SECRET = your-secure-random-token
```

**Important**: Use a strong random token. You can generate one with:
```bash
openssl rand -base64 32
```

### Local Development
Add to `.env.local`:
```env
CRON_SECRET=your-secure-random-token
DATABASE_URL=postgresql://postgres:password@localhost:5432/ICE_ERP?schema=public
```

## Usage

### Automatic Daily Import
The GitHub Actions workflow runs automatically every day at 19:00 Tbilisi time. No action required.

### Manual Trigger via GitHub Actions
1. Go to GitHub repository → Actions → "Import NBG Exchange Rates"
2. Click "Run workflow" → "Run workflow"
3. Wait for completion (usually 1-2 minutes)

### Manual Trigger via Vercel API
```bash
curl -X POST https://your-app.vercel.app/api/cron/sync-nbg-rates \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Example response:
```json
{
  "success": true,
  "message": "NBG rates synced successfully",
  "output": "..."
}
```

### Local Script Execution
```bash
# Using npm script
npm run import:nbg-rates

# Direct Python execution
python scripts/update-nbg-rates.py
```

## How It Works

### Weekday Flow
1. Script detects it's a weekday (Monday-Friday)
2. Fetches latest rates from NBG API: `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/`
3. Divides rates by quantity to get per-unit rates (e.g., RUB: 100 = 3.47 → 1 = 0.0347)
4. Updates or inserts today's record in `nbg_exchange_rates` table
5. Auto-backfills any missing dates since last record

### Weekend Flow
1. Script detects it's Saturday or Sunday
2. Queries database for Friday's rates
3. Inserts Saturday/Sunday record with Friday's rates
4. Logs weekend date for transparency

### Auto-Backfill with Weekend Handling
- Checks for gaps between last record and today
- For missing weekdays: fetches from NBG API
- For missing weekends: copies from appropriate Friday
- Ensures continuous data without manual intervention

## Tracked Currencies
- **USD** - US Dollar
- **EUR** - Euro
- **CNY** - Chinese Yuan
- **GBP** - British Pound
- **RUB** - Russian Ruble
- **TRY** - Turkish Lira
- **AED** - UAE Dirham
- **KZT** - Kazakhstani Tenge

All rates stored as GEL (Georgian Lari) per 1 unit of foreign currency.

## Database Schema
```sql
CREATE TABLE nbg_exchange_rates (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  usd_rate DECIMAL(10,6),
  eur_rate DECIMAL(10,6),
  cny_rate DECIMAL(10,6),
  gbp_rate DECIMAL(10,6),
  rub_rate DECIMAL(10,6),
  try_rate DECIMAL(10,6),
  aed_rate DECIMAL(10,6),
  kzt_rate DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### GitHub Actions Failure
**Check**:
1. `DATABASE_URL` secret is set correctly
2. Database connection string includes `?pgbouncer=true&connection_limit=1`
3. Python dependencies are installing (psycopg2-binary, requests)

**View Logs**: Repository → Actions → Select failed workflow → View logs

### Vercel Endpoint Returns Error
**Check**:
1. `CRON_SECRET` environment variable is set in Vercel
2. Request includes `Authorization: Bearer YOUR_CRON_SECRET` header
3. Python dependencies are available in Vercel environment

**View Logs**: Vercel Dashboard → Deployments → Select deployment → Functions → View logs

### Missing Rates in Database
**Manual backfill**:
```bash
# Check current state
python scripts/check-nbg-dates.py

# Run script to fill gaps
python scripts/update-nbg-rates.py
```

### Weekend Rates Not Populating
**Verify**:
1. Friday's rates exist in database before running weekend script
2. Script detects weekend correctly (check logs for "Today is Saturday/Sunday")
3. Database allows INSERT operations

## Monitoring

### Success Indicators
- ✅ Daily record exists for current date
- ✅ Weekend records match Friday's rates
- ✅ No gaps in date sequence
- ✅ All 8 currency rates populated

### Check Current State
```sql
-- View latest rates
SELECT * FROM nbg_exchange_rates 
ORDER BY date DESC 
LIMIT 7;

-- Find gaps in dates
SELECT date + 1 as missing_date
FROM nbg_exchange_rates
WHERE NOT EXISTS (
  SELECT 1 FROM nbg_exchange_rates t2
  WHERE t2.date = nbg_exchange_rates.date + 1
)
ORDER BY date DESC;
```

## Security

### Authentication
- Vercel endpoint requires `CRON_SECRET` header
- Only authorized GitHub Actions can access workflow
- Database credentials stored as secrets

### Best Practices
- Rotate `CRON_SECRET` regularly
- Use connection pooling for database
- Limit Vercel function timeout to 60s
- Monitor workflow execution logs

## Future Enhancements
- [ ] Email notifications on failure
- [ ] Slack webhook integration
- [ ] Historical rate comparison alerts
- [ ] Rate volatility detection
- [ ] Multi-currency validation
- [ ] Automatic retry on failure

## Support
For issues or questions, contact: iceerpgeorgia@gmail.com
