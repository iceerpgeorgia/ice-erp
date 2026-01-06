#!/usr/bin/env python3
"""
Check the 5 missing payment IDs against payment_id_duplicates table
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

# Connect to database
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

missing_ids = [
    '3c81b9_c8_b2fa20',
    '606684_69_9cd35d',
    '6f1314_ab_988340',
    '7e6dfe_b6_912606',
    'd0a9af_14_a51290'
]

print("=" * 80)
print("CHECKING MISSING PAYMENT IDs AGAINST DUPLICATES TABLE")
print("=" * 80)

for payment_id in missing_ids:
    print(f"\n{payment_id}:")
    
    # Check if it's a duplicate_payment_id
    cur.execute("""
        SELECT master_payment_id, project_uuid, counteragent_uuid
        FROM payment_id_duplicates
        WHERE duplicate_payment_id = %s
    """, (payment_id,))
    
    dup_result = cur.fetchone()
    if dup_result:
        print(f"  ✓ Found as DUPLICATE → master: {dup_result[0]}")
        print(f"    Project: {dup_result[1]}")
        print(f"    Counteragent: {dup_result[2]}")
        
        # Check if master exists in payments
        cur.execute("SELECT payment_id FROM payments WHERE payment_id = %s", (dup_result[0],))
        if cur.fetchone():
            print(f"    Master payment EXISTS in payments table")
        else:
            print(f"    ⚠ Master payment NOT FOUND in payments table")
    else:
        # Check if it's a master_payment_id
        cur.execute("""
            SELECT duplicate_payment_id, project_uuid, counteragent_uuid
            FROM payment_id_duplicates
            WHERE master_payment_id = %s
        """, (payment_id,))
        
        master_results = cur.fetchall()
        if master_results:
            print(f"  ✓ Found as MASTER with {len(master_results)} duplicates:")
            for dup in master_results[:3]:
                print(f"    - Duplicate: {dup[0]}")
            if len(master_results) > 3:
                print(f"    ... and {len(master_results) - 3} more")
            
            # Check if exists in payments
            cur.execute("SELECT payment_id FROM payments WHERE payment_id = %s", (payment_id,))
            if cur.fetchone():
                print(f"    Payment EXISTS in payments table")
            else:
                print(f"    ⚠ Payment NOT FOUND in payments table")
        else:
            print(f"  ✗ NOT FOUND in payment_id_duplicates table")
            
            # Check if exists in payments
            cur.execute("SELECT payment_id FROM payments WHERE payment_id = %s", (payment_id,))
            if cur.fetchone():
                print(f"    But payment EXISTS in payments table")
            else:
                print(f"    Payment NOT FOUND in payments table either")

cur.close()
conn.close()

print("\n" + "=" * 80)
