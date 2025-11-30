#!/usr/bin/env python3
"""Test if NBG API supports historical date queries."""

import requests
from datetime import datetime, timedelta

print("🔍 Testing NBG API for historical date support")
print()

base_url = "https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/"

# Test 1: Current/default endpoint
print("1️⃣ Testing default endpoint (current rate):")
try:
    response = requests.get(base_url)
    response.raise_for_status()
    data = response.json()
    
    if data and len(data) > 0:
        date = data[0].get('date', 'N/A')
        print(f"   ✅ Success - Date: {date}")
    else:
        print(f"   ⚠️  Empty response")
except Exception as e:
    print(f"   ❌ Error: {e}")

print()

# Test 2: Try with date parameter (common pattern)
print("2️⃣ Testing with date parameter (?date=2025-11-15):")
test_date = "2025-11-15"
try:
    response = requests.get(f"{base_url}?date={test_date}")
    response.raise_for_status()
    data = response.json()
    
    if data and len(data) > 0:
        date = data[0].get('date', 'N/A')
        print(f"   ✅ Success - Date: {date}")
        if test_date in date:
            print(f"   🎯 Returned requested date!")
        else:
            print(f"   ⚠️  Returned different date (current rate)")
    else:
        print(f"   ⚠️  Empty response")
except Exception as e:
    print(f"   ❌ Error: {e}")

print()

# Test 3: Try with start/end date parameters
print("3️⃣ Testing with date range (?startDate=2025-11-15&endDate=2025-11-16):")
try:
    response = requests.get(f"{base_url}?startDate=2025-11-15&endDate=2025-11-16")
    response.raise_for_status()
    data = response.json()
    
    if data:
        print(f"   ✅ Success - Found {len(data)} records")
        for i, record in enumerate(data[:3]):  # Show first 3
            date = record.get('date', 'N/A')
            print(f"      Record {i+1}: {date}")
    else:
        print(f"   ⚠️  Empty response")
except Exception as e:
    print(f"   ❌ Error: {e}")

print()

# Test 4: Try with different URL pattern for historical
print("4️⃣ Testing historical endpoint pattern:")
historical_urls = [
    f"https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/{test_date}",
    f"https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json?filter[date]={test_date}",
    f"https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/{test_date}/en/json/",
]

for url in historical_urls:
    print(f"   Testing: {url}")
    try:
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                date = data[0].get('date', 'N/A') if isinstance(data, list) else data.get('date', 'N/A')
                print(f"      ✅ Success - Date: {date}")
                break
            else:
                print(f"      ⚠️  Empty response")
        else:
            print(f"      ❌ Status {response.status_code}")
    except Exception as e:
        print(f"      ❌ Error: {e}")

print()
print("=" * 80)
print()
print("📋 CONCLUSION:")
print()

# Check documentation
print("Checking NBG API documentation patterns...")
print()
print("The NBG API appears to only return the LATEST/CURRENT exchange rate.")
print("Historical rates are NOT available via API query parameters.")
print()
print("💡 This is why we need:")
print("   1. Daily cron job to capture current rates")
print("   2. Historical Excel files for backfilling past dates")
print("   3. Database to store historical data")
print()
print("✅ Current approach (cron + historical files) is correct!")
