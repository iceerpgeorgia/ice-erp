import requests
from datetime import datetime, timedelta

# Note: NBG API returns the latest available rate, not historical data by date parameter
# The API doesn't support fetching rates for specific past dates
print("Fetching latest NBG exchange rates...")

response = requests.get('https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json')
data = response.json()

rate_date = data[0]['date'][:10]
currencies = data[0]['currencies']

usd = next((c for c in currencies if c['code'] == 'USD'), None)

if usd:
    rate_per_unit = usd['rate'] / usd['quantity']
    change_symbol = "↑" if usd['diff'] > 0 else "↓" if usd['diff'] < 0 else "→"
    
    print(f"\n{'='*60}")
    print(f"USD/GEL EXCHANGE RATE")
    print(f"{'='*60}")
    print(f"Date: {rate_date}")
    print(f"Rate: {usd['rate']} GEL per {usd['quantity']} USD")
    print(f"Rate per 1 USD: {rate_per_unit:.6f} GEL")
    print(f"Daily change: {change_symbol} {abs(usd['diff']):.4f} GEL")
    print(f"{'='*60}")
    
    print(f"\nCONVERSION EXAMPLES:")
    print(f"  1 USD = {rate_per_unit:.4f} GEL")
    print(f"  100 USD = {rate_per_unit * 100:.2f} GEL")
    print(f"  1,000 USD = {rate_per_unit * 1000:.2f} GEL")
    print(f"  100 GEL = {100 / rate_per_unit:.2f} USD")
else:
    print("USD not found in response")
