# National Bank of Georgia (NBG) Exchange Rates API

## Overview
The National Bank of Georgia provides a free, public API for accessing official exchange rates. The API returns daily exchange rates for all currencies against Georgian Lari (GEL).

## API Endpoints

### JSON Format (Recommended)
```
https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/json
```

### XML/RSS Format
```
https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/ka/rss
```

### English Version
```
https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json
```

## Response Format

### JSON Structure
```json
[
  {
    "date": "2025-11-11T00:00:00.000Z",
    "currencies": [
      {
        "code": "USD",
        "quantity": 1,
        "rateFormated": "2.7065",
        "diffFormated": "0.0010",
        "rate": 2.7065,
        "name": "აშშ დოლარი",
        "diff": -0.0010,
        "date": "2025-11-10T17:01:06.275Z",
        "validFromDate": "2025-11-11T00:00:00.000Z"
      },
      {
        "code": "EUR",
        "quantity": 1,
        "rateFormated": "3.1293",
        "diffFormated": "0.0021",
        "rate": 3.1293,
        "name": "ევრო",
        "diff": 0.0021,
        "date": "2025-11-10T17:01:06.275Z",
        "validFromDate": "2025-11-11T00:00:00.000Z"
      }
      // ... more currencies
    ]
  }
]
```

### Field Descriptions
- **code**: 3-letter ISO currency code (USD, EUR, GEL, etc.)
- **quantity**: Base quantity for the rate (e.g., 1, 10, 100, 1000)
- **rate**: Exchange rate (how many GEL for the specified quantity)
- **rateFormated**: Formatted string version of the rate
- **diff**: Daily change in rate (positive = GEL strengthened, negative = GEL weakened)
- **diffFormated**: Formatted string version of diff
- **name**: Currency name in Georgian (or English if using /en/ endpoint)
- **date**: Timestamp when rate was published
- **validFromDate**: Date from which this rate is valid

## Available Currencies

The API returns rates for **40+ currencies** including:

### Major Currencies
- **USD** - US Dollar
- **EUR** - Euro
- **GBP** - British Pound Sterling
- **CHF** - Swiss Franc
- **JPY** - Japanese Yen
- **CNY** - Chinese Yuan

### Regional Currencies
- **RUB** - Russian Ruble
- **TRY** - Turkish Lira
- **AMD** - Armenian Dram
- **AZN** - Azerbaijani Manat
- **UAH** - Ukrainian Hryvnia
- **KZT** - Kazakhstani Tenge

### Other Currencies
- **CAD**, **AUD**, **NZD** - Commonwealth Dollars
- **SEK**, **NOK**, **DKK** - Scandinavian Currencies
- **PLN**, **CZK**, **HUF** - Eastern European Currencies
- And many more...

## Usage Examples

### JavaScript/TypeScript (Fetch)
```typescript
interface NBGCurrency {
  code: string;
  quantity: number;
  rate: number;
  diff: number;
  name: string;
  validFromDate: string;
}

interface NBGResponse {
  date: string;
  currencies: NBGCurrency[];
}

async function getNBGRates(): Promise<NBGResponse[]> {
  const response = await fetch(
    'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json'
  );
  return await response.json();
}

// Get specific currency rate
async function getUSDRate(): Promise<number> {
  const data = await getNBGRates();
  const usd = data[0].currencies.find(c => c.code === 'USD');
  return usd ? usd.rate : 0;
}

// Get all rates as a map
async function getRatesMap(): Promise<Map<string, number>> {
  const data = await getNBGRates();
  const map = new Map<string, number>();
  
  data[0].currencies.forEach(currency => {
    // Normalize to rate per 1 unit
    const normalizedRate = currency.rate / currency.quantity;
    map.set(currency.code, normalizedRate);
  });
  
  return map;
}
```

### Python
```python
import requests
from datetime import datetime

def get_nbg_rates():
    """Fetch current exchange rates from NBG"""
    url = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json'
    response = requests.get(url)
    return response.json()

def get_currency_rate(currency_code):
    """Get rate for specific currency"""
    data = get_nbg_rates()
    for currency in data[0]['currencies']:
        if currency['code'] == currency_code:
            # Normalize to rate per 1 unit
            return currency['rate'] / currency['quantity']
    return None

# Example usage
usd_rate = get_currency_rate('USD')
eur_rate = get_currency_rate('EUR')
print(f"1 USD = {usd_rate} GEL")
print(f"1 EUR = {eur_rate} GEL")
```

### SQL (PostgreSQL) Import
```sql
-- Create table for exchange rates
CREATE TABLE nbg_exchange_rates (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    rate NUMERIC(15, 6) NOT NULL,
    quantity INTEGER NOT NULL,
    rate_per_unit NUMERIC(15, 6) NOT NULL,
    daily_change NUMERIC(15, 6),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(date, currency_code)
);

-- Index for fast lookups
CREATE INDEX idx_nbg_rates_date_currency ON nbg_exchange_rates(date, currency_code);
CREATE INDEX idx_nbg_rates_currency_date ON nbg_exchange_rates(currency_code, date DESC);
```

## Update Frequency

- **Daily updates**: New rates are published every business day around **17:00-18:00 Georgian time**
- **Weekend rates**: No updates on weekends and holidays; previous business day rates remain valid
- **Valid from**: Rates are typically valid from the next calendar day

## Rate Calculation

**Important**: Some currencies have a quantity > 1. To get the rate for 1 unit:

```
rate_per_1_unit = rate / quantity
```

**Examples**:
- USD: quantity=1, rate=2.7065 → **1 USD = 2.7065 GEL**
- JPY: quantity=100, rate=1.7556 → **1 JPY = 0.017556 GEL**
- RUB: quantity=100, rate=3.3438 → **1 RUB = 0.033438 GEL**

## Integration Recommendations

### For Database Import
1. **Schedule**: Run import daily at 18:00 Georgian time (UTC+4)
2. **Retry logic**: If fetch fails, retry every hour until 23:00
3. **Normalization**: Always store `rate_per_unit = rate / quantity`
4. **Currency validation**: Only import currencies your system supports
5. **History**: Keep historical rates for trend analysis and reporting

### For Real-time Display
1. **Cache**: Cache rates in memory/Redis for 1 hour
2. **Fallback**: Use previous day's rate if API is unavailable
3. **Error handling**: Always have default/fallback rates
4. **Display**: Show the date/time when rates were last updated

### For Conversion
```typescript
// Convert from foreign currency to GEL
function toGEL(amount: number, fromCurrency: string, rates: Map<string, number>): number {
  const rate = rates.get(fromCurrency);
  if (!rate) throw new Error(`Rate not found for ${fromCurrency}`);
  return amount * rate;
}

// Convert from GEL to foreign currency
function fromGEL(amount: number, toCurrency: string, rates: Map<string, number>): number {
  const rate = rates.get(toCurrency);
  if (!rate) throw new Error(`Rate not found for ${toCurrency}`);
  return amount / rate;
}

// Convert between two foreign currencies (via GEL)
function convert(amount: number, from: string, to: string, rates: Map<string, number>): number {
  const gelAmount = toGEL(amount, from, rates);
  return fromGEL(gelAmount, to, rates);
}
```

## Error Handling

The API is generally reliable, but implement these safeguards:

```typescript
async function fetchRatesWithRetry(maxRetries = 3): Promise<NBGResponse[]> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(NBG_API_URL, {
        timeout: 5000 // 5 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data || !data[0] || !data[0].currencies || data[0].currencies.length === 0) {
        throw new Error('Invalid response structure');
      }
      
      return data;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Official Documentation

- **Main website**: https://nbg.gov.ge
- **Exchange rates page**: https://nbg.gov.ge/en/monetary-policy/currency
- **No official API documentation**: The API is public and undocumented, but stable and widely used

## Notes

- ✅ **Free**: No API key or authentication required
- ✅ **CORS enabled**: Can be called from browser JavaScript
- ✅ **Stable**: Used by banks, financial institutions, and government agencies
- ✅ **Reliable**: Very high uptime (99%+)
- ⚠️ **No historical data**: Only returns current/latest rates
- ⚠️ **No intraday updates**: Only one rate per business day
- ⚠️ **Georgian holidays**: No updates on Georgian public holidays

## Alternative Data Sources

If you need historical rates, use:
- NBG Statistical database: https://nbg.gov.ge/statistics/statistics-data
- World Bank Data
- IMF Data
- OANDA API (commercial)
