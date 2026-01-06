#!/usr/bin/env python3
"""
Check payment ID format in database
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("Total payments in database:")
cur.execute("SELECT COUNT(*) FROM payments WHERE is_active = true")
print(f"  {cur.fetchone()[0]} active payments")

cur.execute("SELECT COUNT(*) FROM payments")
print(f"  {cur.fetchone()[0]} total payments (including inactive)")

print("\nChecking for payment with ID 4195:")
cur.execute("""
    SELECT 
        id,
        payment_id,
        record_uuid,
        project_uuid,
        counteragent_uuid,
        is_active
    FROM payments
    WHERE id = 4195
""")

results = cur.fetchall()
if results:
    for row in results:
        print(f"  ✓ Found!")
        print(f"    id: {row[0]}")
        print(f"    payment_id: {row[1]}")
        print(f"    record_uuid: {row[2]}")
        print(f"    project_uuid: {row[3]}")
        print(f"    counteragent_uuid: {row[4]}")
        print(f"    is_active: {row[5]}")
else:
    print(f"  ✗ No payment found with id=4195")

print("\nSearching for payment_id containing '0d4941_ba_a7cac6':")
cur.execute("""
    SELECT 
        id,
        payment_id
    FROM payments
    WHERE payment_id LIKE '%0d4941%' OR payment_id = '0d4941_ba_a7cac6'
""")

results = cur.fetchall()
if results:
    for row in results:
        print(f"  ✓ Found: ID {row[0]}, payment_id = {row[1]}")
else:
    print(f"  ✗ No payment found with this pattern")

print("\n\nSample of payment_id formats in database:")
cur.execute("""
    SELECT id, payment_id
    FROM payments
    WHERE is_active = true
    LIMIT 20
""")

for row in cur.fetchall():
    print(f"  ID {row[0]}: payment_id = {row[1]}")

conn.close()
