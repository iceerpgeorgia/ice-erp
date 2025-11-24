#!/usr/bin/env python3
"""Fill Nov 16-17 with previous rates in production."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("✓ Connected to production database")
print()

# Get Nov 15 rates (last known good rates before the gap)
cursor.execute("""
    SELECT usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
    FROM nbg_exchange_rates
    WHERE date = '2025-11-15'
""")

nov15_rates = cursor.fetchone()

if not nov15_rates:
    print("❌ No data for Nov 15")
    cursor.close()
    conn.close()
    exit(1)

print("📅 Nov 15 rates retrieved")
print(f"   USD: {float(nov15_rates[0]):.4f}, EUR: {float(nov15_rates[1]):.4f}")
print()

# Update Nov 16 and Nov 17 with Nov 15 rates
for date in ['2025-11-16', '2025-11-17']:
    cursor.execute("""
        UPDATE nbg_exchange_rates
        SET usd_rate = %s, eur_rate = %s, cny_rate = %s, gbp_rate = %s,
            rub_rate = %s, try_rate = %s, aed_rate = %s, kzt_rate = %s
        WHERE date = %s
    """, nov15_rates + (date,))
    
    conn.commit()
    print(f"✅ Updated {date} with Nov 15 rates")

print()
print("🔍 Verification - Nov 13-19:")
cursor.execute("""
    SELECT date, usd_rate, eur_rate
    FROM nbg_exchange_rates
    WHERE date >= '2025-11-13' AND date <= '2025-11-19'
    ORDER BY date
""")

for row in cursor.fetchall():
    date, usd, eur = row
    usd_val = float(usd) if usd else 0
    eur_val = float(eur) if eur else 0
    print(f"   {date}: USD={usd_val:.4f}, EUR={eur_val:.4f}")

cursor.close()
conn.close()
