#!/usr/bin/env python3
"""Test the backfill script by creating a gap and filling it."""

import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
if not database_url:
    print("❌ DATABASE_URL not set")
    exit(1)

database_url = database_url.split('?')[0]
conn = psycopg2.connect(database_url)
cursor = conn.cursor()

print("🧪 Testing backfill script...")
print()

# Create a test gap by deleting Nov 15
print("1️⃣ Creating test gap (deleting Nov 15)...")
cursor.execute("DELETE FROM nbg_exchange_rates WHERE date = '2025-11-15'")
conn.commit()
print("   ✓ Deleted Nov 15")
print()

# Check the gap
print("2️⃣ Verifying gap exists...")
cursor.execute("""
    SELECT date 
    FROM nbg_exchange_rates 
    WHERE date BETWEEN '2025-11-13' AND '2025-11-17'
    ORDER BY date
""")
dates = [row[0] for row in cursor.fetchall()]
print(f"   Dates in DB: {', '.join(str(d) for d in dates)}")
if '2025-11-15' not in [str(d) for d in dates]:
    print("   ✓ Gap confirmed: Nov 15 is missing")
else:
    print("   ❌ Gap not created")

print()
print("3️⃣ Now run the backfill script to fill the gap:")
print("   python scripts/backfill-nbg-from-api.py 2025-11-15 2025-11-15")

cursor.close()
conn.close()
