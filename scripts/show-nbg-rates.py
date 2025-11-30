#!/usr/bin/env python3
"""Display NBG exchange rates for yesterday"""

import requests
import json
from datetime import datetime

# Fetch data from NBG API
url = 'https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json'
response = requests.get(url)
data = response.json()

# Parse data
date_str = data[0]['date']
date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
currencies = data[0]['currencies']

print("\n" + "=" * 100)
print("NATIONAL BANK OF GEORGIA - OFFICIAL EXCHANGE RATES")
print("=" * 100)
print(f"Date: {date_obj.strftime('%A, %B %d, %Y')}")
print(f"Total currencies: {len(currencies)}")
print("=" * 100)

# Display major currencies first
major_currencies = ['USD', 'EUR', 'GBP', 'CHF', 'RUB', 'TRY', 'JPY', 'CNY']
print("\nMAJOR CURRENCIES:")
print("-" * 100)
print(f"{'Code':<6} {'Quantity':<10} {'Rate (GEL)':<15} {'Per 1 Unit':<15} {'Change':<12} {'Currency Name':<30}")
print("-" * 100)

for code in major_currencies:
    curr = next((c for c in currencies if c['code'] == code), None)
    if curr:
        rate_per_unit = curr['rate'] / curr['quantity']
        change_symbol = "↑" if curr['diff'] > 0 else "↓" if curr['diff'] < 0 else "→"
        print(f"{curr['code']:<6} {curr['quantity']:<10} {curr['rate']:<15.4f} {rate_per_unit:<15.6f} "
              f"{change_symbol} {abs(curr['diff']):<10.4f} {curr['name']:<30}")

# Display regional currencies
regional_currencies = ['AMD', 'AZN', 'UAH', 'KZT', 'BYN', 'UZS']
print("\nREGIONAL CURRENCIES:")
print("-" * 100)
print(f"{'Code':<6} {'Quantity':<10} {'Rate (GEL)':<15} {'Per 1 Unit':<15} {'Change':<12} {'Currency Name':<30}")
print("-" * 100)

for code in regional_currencies:
    curr = next((c for c in currencies if c['code'] == code), None)
    if curr:
        rate_per_unit = curr['rate'] / curr['quantity']
        change_symbol = "↑" if curr['diff'] > 0 else "↓" if curr['diff'] < 0 else "→"
        print(f"{curr['code']:<6} {curr['quantity']:<10} {curr['rate']:<15.4f} {rate_per_unit:<15.6f} "
              f"{change_symbol} {abs(curr['diff']):<10.4f} {curr['name']:<30}")

# Display all other currencies
print("\nALL CURRENCIES (alphabetical):")
print("-" * 100)
print(f"{'Code':<6} {'Quantity':<10} {'Rate (GEL)':<15} {'Per 1 Unit':<15} {'Change':<12} {'Currency Name':<30}")
print("-" * 100)

sorted_currencies = sorted(currencies, key=lambda x: x['code'])
for curr in sorted_currencies:
    rate_per_unit = curr['rate'] / curr['quantity']
    change_symbol = "↑" if curr['diff'] > 0 else "↓" if curr['diff'] < 0 else "→"
    print(f"{curr['code']:<6} {curr['quantity']:<10} {curr['rate']:<15.4f} {rate_per_unit:<15.6f} "
          f"{change_symbol} {abs(curr['diff']):<10.4f} {curr['name']:<30}")

print("\n" + "=" * 100)
print("Legend: ↑ = GEL weakened, ↓ = GEL strengthened, → = no change")
print("Note: Rate shows value in GEL for the specified quantity")
print("      'Per 1 Unit' normalizes all rates to 1 unit of foreign currency")
print("=" * 100 + "\n")

# Show conversion examples
print("CONVERSION EXAMPLES:")
print("-" * 100)
usd = next(c for c in currencies if c['code'] == 'USD')
eur = next(c for c in currencies if c['code'] == 'EUR')
rub = next(c for c in currencies if c['code'] == 'RUB')

usd_rate = usd['rate'] / usd['quantity']
eur_rate = eur['rate'] / eur['quantity']
rub_rate = rub['rate'] / rub['quantity']

print(f"1 USD = {usd_rate:.4f} GEL")
print(f"100 USD = {usd_rate * 100:.2f} GEL")
print(f"1000 USD = {usd_rate * 1000:.2f} GEL")
print()
print(f"1 EUR = {eur_rate:.4f} GEL")
print(f"100 EUR = {eur_rate * 100:.2f} GEL")
print(f"1000 EUR = {eur_rate * 1000:.2f} GEL")
print()
print(f"1 RUB = {rub_rate:.6f} GEL")
print(f"100 RUB = {rub_rate * 100:.4f} GEL")
print(f"1000 RUB = {rub_rate * 1000:.2f} GEL")
print()
print(f"100 GEL = {100 / usd_rate:.2f} USD")
print(f"100 GEL = {100 / eur_rate:.2f} EUR")
print(f"100 GEL = {100 / rub_rate:.2f} RUB")
print("=" * 100 + "\n")
