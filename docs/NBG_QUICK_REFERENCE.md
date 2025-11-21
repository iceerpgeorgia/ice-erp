# NBG Exchange Rates - Quick Reference

## 🚀 Quick Start Commands

### Check System Health
```bash
python scripts/validate-nbg-system.py
```

### Update Rates (Run Daily)
```bash
python scripts/update-nbg-rates.py
```

### Add New Currency
```bash
# 1. Add to currencies table first
# 2. Then sync columns:
python scripts/sync-currency-columns.py

# 3. Fetch rates:
python scripts/update-nbg-rates.py
```

### Re-import Historical Data (if needed)
```bash
python scripts/import-nbg-historical-rates.py
```

## 📊 Current System Status

✅ **System Health**: Operational  
✅ **Records**: 5,430 dates (2011-2025)  
✅ **Currencies**: 8 tracked (USD, EUR, CNY, GBP, RUB, TRY, AED, KZT)  
✅ **Up to Date**: Latest rates from 2025-11-12  
✅ **No Gaps**: Complete date coverage  

## 🔧 Common Tasks

### View Latest Rates
```sql
SELECT date, usd_rate, eur_rate, gbp_rate, rub_rate
FROM nbg_exchange_rates
ORDER BY date DESC
LIMIT 1;
```

### Convert Currency
```sql
-- 100 USD to GEL
SELECT 100 * usd_rate as gel_amount
FROM nbg_exchange_rates
WHERE date = CURRENT_DATE;
```

### API Usage
```bash
# Latest rates
curl http://localhost:3000/api/exchange-rates

# Specific currency and date
curl "http://localhost:3000/api/exchange-rates?date=2025-11-12&currency=USD"

# Date range
curl "http://localhost:3000/api/exchange-rates?startDate=2025-11-01&endDate=2025-11-12"
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `scripts/update-nbg-rates.py` | **Daily rate updater** (main service) |
| `scripts/validate-nbg-system.py` | System health check |
| `scripts/sync-currency-columns.py` | Add currency columns |
| `scripts/import-nbg-historical-rates.py` | Historical data import |
| `app/api/exchange-rates/route.ts` | API endpoint |
| `docs/NBG_EXCHANGE_RATES.md` | Complete documentation |
| `docs/NBG_IMPLEMENTATION_SUMMARY.md` | Implementation details |

## 🎯 Rate Logic

### NBG API Format
```
Code: RUB, Quantity: 100, Rate: 3.3255
```

### Our Storage
```
rub_rate = 3.3255 / 100 = 0.033255
```

### Usage
```
1000 RUB × 0.033255 = 33.255 GEL
```

## ⏰ Automation Setup

### Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 19:00
4. Action: Start Program
   - Program: `python`
   - Arguments: `scripts/update-nbg-rates.py`
   - Start in: `c:\next-postgres-starter`

### Linux/Mac Cron
```bash
# Edit crontab
crontab -e

# Add line:
0 19 * * * cd /path/to/next-postgres-starter && python scripts/update-nbg-rates.py >> logs/nbg-update.log 2>&1
```

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Data is X days behind | `python scripts/update-nbg-rates.py` |
| Missing currency column | `python scripts/sync-currency-columns.py` |
| System health check fails | Review validation output for specific issues |
| API returns 404 | Check if dev server is running (`pnpm dev`) |
| Rate seems wrong | Verify on NBG website, check calculation logic |

## 📞 NBG Resources

- **API**: https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/
- **Website**: https://nbg.gov.ge
- **Update Time**: Daily at 18:30 Georgian time
- **Weekend/Holidays**: No updates (uses previous business day)

## ✅ Validation Checklist

Run `python scripts/validate-nbg-system.py` and verify:

- [x] Table exists
- [x] Data present (5,000+ records)
- [x] Latest date is today or within 3 days
- [x] All active currencies have columns
- [x] No gaps in last 30 days
- [x] Rates within expected ranges

## 🎉 Success Indicators

✅ Validation script shows "System is healthy"  
✅ Latest date = today (or yesterday if run before 19:00)  
✅ All currencies returning rates in API  
✅ No errors in update logs  
✅ Rates match NBG website  

---

**Last Updated**: November 12, 2025  
**Status**: ✅ Operational  
**Next Action**: Schedule daily updates
