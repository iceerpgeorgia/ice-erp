#!/usr/bin/env python3
"""Compare cron job results with actual Supabase data for Nov 19."""

import os
import psycopg2
import requests

print("🔍 Comparing Nov 19, 2025 cron job vs Supabase data")
print()

# 1. Fetch from NBG API (what cron should have gotten)
print("📡 Fetching current NBG API data...")
try:
    response = requests.get("https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/")
    response.raise_for_status()
    nbg_data = response.json()
    
    if nbg_data and len(nbg_data) > 0:
        rate_data = nbg_data[0]
        currencies = rate_data.get('currencies', [])
        nbg_date = rate_data.get('date', '')
        
        print(f"   Date from API: {nbg_date}")
        
        nbg_rates = {}
        for currency in currencies:
            code = currency.get('code', '').upper()
            quantity = float(currency.get('quantity', 1))
            rate = float(currency.get('rate', 0))
            
            if code and rate > 0:
                rate_per_unit = rate / quantity
                
                if code in ['USD', 'EUR', 'CNY', 'GBP', 'RUB', 'TRY', 'AED', 'KZT']:
                    nbg_rates[code] = rate_per_unit
        
        print(f"   Found {len(nbg_rates)} currencies")
        print()
except Exception as e:
    print(f"   ❌ Error: {e}")
    print()
    nbg_rates = {}

# 2. Query Supabase for Nov 19
print("💾 Querying Supabase for Nov 19, 2025...")

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

cursor.execute("""
    SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
    WHERE date = '2025-11-19'
""")

result = cursor.fetchone()

if not result:
    print("   ❌ No data found for Nov 19 in Supabase")
    cursor.close()
    conn.close()
    exit(1)

date, usd_db, eur_db, cny_db, gbp_db, rub_db, try_db, aed_db, kzt_db = result

db_rates = {
    'USD': float(usd_db) if usd_db else 0,
    'EUR': float(eur_db) if eur_db else 0,
    'CNY': float(cny_db) if cny_db else 0,
    'GBP': float(gbp_db) if gbp_db else 0,
    'RUB': float(rub_db) if rub_db else 0,
    'TRY': float(try_db) if try_db else 0,
    'AED': float(aed_db) if aed_db else 0,
    'KZT': float(kzt_db) if kzt_db else 0,
}

print(f"   Date in DB: {date}")
print(f"   Found {sum(1 for v in db_rates.values() if v > 0)} currencies with data")
print()

# 3. The cron job response we got earlier
print("🤖 Cron job response (from our test):")
cron_rates = {
    'USD': 2.7078,
    'EUR': 3.1367,
    'CNY': 0.38075,
    'GBP': 3.5599,
    'RUB': 0.033394,
    'TRY': 0.0639,
    'AED': 0.73722,
    'KZT': 0.0052,
}
print(f"   Date: 2025-11-19")
print(f"   Currencies: {len(cron_rates)}")
print()

# 4. Compare all three sources
print("=" * 80)
print("📊 COMPARISON")
print("=" * 80)
print()
print(f"{'Currency':<10} {'NBG API':<15} {'Cron Response':<15} {'Supabase DB':<15} {'Status'}")
print("-" * 80)

all_currencies = set(nbg_rates.keys()) | set(cron_rates.keys()) | set(db_rates.keys())

for currency in sorted(all_currencies):
    nbg_val = nbg_rates.get(currency, 0)
    cron_val = cron_rates.get(currency, 0)
    db_val = db_rates.get(currency, 0)
    
    # Determine status
    if db_val == 0:
        status = "❌ MISSING"
    elif abs(db_val - cron_val) < 0.0001:
        status = "✅ MATCH"
    else:
        status = f"⚠️  DIFF ({abs(db_val - cron_val):.6f})"
    
    print(f"{currency:<10} {nbg_val:<15.6f} {cron_val:<15.6f} {db_val:<15.6f} {status}")

print()
print("=" * 80)

# Check if data was updated vs inserted
print()
print("🕐 Last updated timestamp:")
cursor.execute("""
    SELECT date, 
           EXTRACT(EPOCH FROM (NOW() - CURRENT_TIMESTAMP)) as age_seconds
    FROM nbg_exchange_rates
    WHERE date = '2025-11-19'
""")
result = cursor.fetchone()
if result:
    print(f"   Nov 19 record exists (we can't see exact update time with current schema)")

# Check if there are any audit logs
cursor.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
""")
if cursor.fetchone():
    cursor.execute("""
        SELECT action, created_at
        FROM audit_logs
        WHERE "table" = 'nbg_exchange_rates'
        AND record_id::text LIKE '%2025-11-19%'
        ORDER BY created_at DESC
        LIMIT 5
    """)
    audit_logs = cursor.fetchall()
    if audit_logs:
        print()
        print("📝 Recent audit logs for Nov 19:")
        for action, created_at in audit_logs:
            print(f"   {action}: {created_at}")

cursor.close()
conn.close()
