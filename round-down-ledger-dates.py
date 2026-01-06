#!/usr/bin/env python3
"""
Round down effective_date in payments_ledger table to remove time component
Equivalent to Excel's ROUNDDOWN(effective_date, 0)
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

print("=" * 80)
print("ROUND DOWN EFFECTIVE DATES IN PAYMENTS LEDGER")
print("=" * 80)

# Connect to database
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()
print("\nDatabase connected")

# Check current state
print("\nChecking current effective_date values...")
cur.execute("""
    SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT effective_date::date) as unique_dates,
        MIN(effective_date) as min_date,
        MAX(effective_date) as max_date
    FROM payments_ledger
""")
row = cur.fetchone()
print(f"  Total rows: {row[0]}")
print(f"  Unique dates: {row[1]}")
print(f"  Date range: {row[2]} to {row[3]}")

# Check if any dates have time components
cur.execute("""
    SELECT COUNT(*)
    FROM payments_ledger
    WHERE effective_date::time != '00:00:00'
""")
with_time = cur.fetchone()[0]
print(f"  Rows with time component: {with_time}")

if with_time == 0:
    print("\n✓ All dates are already rounded down (no time component)")
    print("No changes needed")
else:
    print(f"\nRounding down {with_time} dates with time components...")
    
    # Update effective_date to remove time component
    cur.execute("""
        UPDATE payments_ledger
        SET effective_date = effective_date::date
        WHERE effective_date::time != '00:00:00'
    """)
    
    updated = cur.rowcount
    print(f"✓ Updated {updated} rows")
    
    # Commit changes
    conn.commit()
    print("✓ Changes committed")
    
    # Verify
    cur.execute("""
        SELECT COUNT(*)
        FROM payments_ledger
        WHERE effective_date::time != '00:00:00'
    """)
    remaining = cur.fetchone()[0]
    
    if remaining == 0:
        print("\n✓ Verification successful: All dates are now rounded down")
    else:
        print(f"\n⚠ Warning: {remaining} rows still have time components")

cur.close()
conn.close()

print("\n" + "=" * 80)
print("DONE")
print("=" * 80)
