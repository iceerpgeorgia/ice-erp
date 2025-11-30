#!/usr/bin/env python3
"""Fill specific missing dates in production."""

import os
import psycopg2
from datetime import datetime

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("✓ Connected to production database")
print()

# Missing dates to fill
missing_dates = [
    datetime(2025, 11, 14).date(),
    datetime(2025, 11, 15).date(),
    datetime(2025, 11, 16).date(),
]

print(f"📅 Filling {len(missing_dates)} missing dates...")
print()

for missing_date in missing_dates:
    # Get the most recent rate before this date
    cursor.execute("""
        SELECT usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate
        FROM nbg_exchange_rates
        WHERE date < %s
        ORDER BY date DESC
        LIMIT 1
    """, (missing_date,))
    
    previous_rates = cursor.fetchone()
    
    if not previous_rates:
        print(f"   ⏭  Skipping {missing_date} - no previous rates")
        continue
    
    try:
        insert_sql = """
            INSERT INTO nbg_exchange_rates 
            (date, usd_rate, eur_rate, cny_rate, gbp_rate, rub_rate, try_rate, aed_rate, kzt_rate)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        values = (missing_date,) + previous_rates
        cursor.execute(insert_sql, values)
        conn.commit()
        
        usd_rate = float(previous_rates[0]) if previous_rates[0] else 0
        print(f"   ✅ {missing_date} filled (USD: {usd_rate:.4f})")
    
    except Exception as e:
        print(f"   ❌ Error filling {missing_date}: {e}")

print()
print("✅ Backfill complete!")

# Verify
print()
print("📊 Verification - Nov 13-19:")
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
