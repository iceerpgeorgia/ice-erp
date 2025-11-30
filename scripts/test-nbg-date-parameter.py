#!/usr/bin/env python3
"""Test NBG API date parameter more thoroughly."""

import requests
from datetime import datetime, timedelta

print("🔍 Testing NBG API ?date parameter for multiple dates")
print()

base_url = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/"

# Test dates from Nov 14-18 (the dates we're trying to fill)
test_dates = [
    "2025-11-14",
    "2025-11-15",
    "2025-11-16",
    "2025-11-17",
    "2025-11-18",
]

print("Testing historical dates:")
print()

results = {}

for test_date in test_dates:
    try:
        response = requests.get(f"{base_url}?date={test_date}")
        response.raise_for_status()
        data = response.json()
        
        if data and len(data) > 0:
            returned_date = data[0].get('date', '')
            currencies = data[0].get('currencies', [])
            
            # Get USD and EUR for quick check
            usd_rate = None
            eur_rate = None
            
            for currency in currencies:
                code = currency.get('code', '').upper()
                quantity = float(currency.get('quantity', 1))
                rate = float(currency.get('rate', 0))
                rate_per_unit = rate / quantity if quantity > 0 else 0
                
                if code == 'USD':
                    usd_rate = rate_per_unit
                elif code == 'EUR':
                    eur_rate = rate_per_unit
            
            # Check if returned date matches requested
            if test_date in returned_date:
                status = "✅ EXACT MATCH"
            else:
                status = f"⚠️  Got {returned_date[:10]}"
            
            results[test_date] = {
                'returned_date': returned_date[:10],
                'usd': usd_rate,
                'eur': eur_rate,
                'status': status
            }
            
            print(f"{test_date}: {status}")
            if usd_rate and eur_rate:
                print(f"   USD: {usd_rate:.4f}, EUR: {eur_rate:.4f}")
        else:
            print(f"{test_date}: ❌ Empty response")
            results[test_date] = {'status': 'EMPTY'}
    
    except Exception as e:
        print(f"{test_date}: ❌ Error: {e}")
        results[test_date] = {'status': f'ERROR: {e}'}

print()
print("=" * 80)
print()

# Check if weekends return nearest date
print("🔍 Checking weekend behavior:")
print()
print("Nov 16 (Saturday) and Nov 17 (Sunday) - checking what API returns...")
print()

for weekend_date in ["2025-11-16", "2025-11-17"]:
    if weekend_date in results:
        result = results[weekend_date]
        print(f"{weekend_date}:")
        print(f"   Requested: {weekend_date}")
        print(f"   Returned: {result.get('returned_date', 'N/A')}")
        print(f"   Status: {result.get('status', 'N/A')}")
        if result.get('usd'):
            print(f"   USD: {result['usd']:.4f}, EUR: {result['eur']:.4f}")

print()
print("=" * 80)
print()
print("💡 CONCLUSION:")
print()

# Check if we got exact matches
exact_matches = sum(1 for r in results.values() if '✅' in r.get('status', ''))
print(f"Exact matches: {exact_matches}/{len(test_dates)}")
print()

if exact_matches >= 3:
    print("✅ The API DOES support the ?date= parameter!")
    print("   We can use this to fetch historical dates instead of Excel files!")
    print()
    print("🚀 This means we can:")
    print("   1. Fetch missing dates directly from NBG API")
    print("   2. Use Excel files only for very old historical data")
    print("   3. Simplify the backfill process")
else:
    print("⚠️  The API returns current date regardless of ?date parameter")
    print("   Weekend dates might return Friday's rate")
    print("   We should continue using Excel files for historical data")
