#!/usr/bin/env python3
"""Check specific dates in production database."""

import os
import psycopg2
from datetime import datetime, timedelta

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]

conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("✓ Connected to production database")
print()

# Check dates from Nov 13 to Nov 19
start_date = datetime(2025, 11, 13).date()
end_date = datetime(2025, 11, 19).date()

print(f"📅 Checking dates from {start_date} to {end_date}:")
print()

current = start_date
while current <= end_date:
    cursor.execute("""
        SELECT date, usd_rate, eur_rate
        FROM nbg_exchange_rates
        WHERE date = %s
    """, (current,))
    
    result = cursor.fetchone()
    
    if result:
        date, usd, eur = result
        usd_val = float(usd) if usd else 0
        eur_val = float(eur) if eur else 0
        print(f"✅ {current}: USD={usd_val:.4f}, EUR={eur_val:.4f}")
    else:
        print(f"❌ {current}: MISSING")
    
    current += timedelta(days=1)

print()
print("📊 Summary:")
cursor.execute("""
    SELECT COUNT(*) 
    FROM nbg_exchange_rates 
    WHERE date >= %s AND date <= %s
""", (start_date, end_date))
count = cursor.fetchone()[0]
print(f"   Found {count} out of 7 dates")

cursor.close()
conn.close()
