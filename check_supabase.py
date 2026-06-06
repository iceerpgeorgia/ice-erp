#!/usr/bin/env python3
"""Check account-specific raw tables for the missing raw records."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'
missing_uuids = [
    '6ec61407-6c08-5ccd-8847-0b4027ba9ae2',
    '1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a',
    '77501426-9a30-5b3f-842a-0270795db7c0',
    'caa2cf8c-7009-5a48-8a3c-a1385c5084e4',
    '06f762fc-3ccc-573c-8f93-c18565a717b4'
]

# Connect to database (which is Supabase)
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"ACCOUNT-SPECIFIC RAW TABLES: Looking for missing raw records")
print(f"{'='*80}\n")

# 1. Find which account-specific raw table contains these records
print("1. Checking account-specific raw tables for these UUIDs:")
print("-" * 80)

# Get list of account-specific raw tables
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE 'GE%'
    AND table_name LIKE '%_BOG_%' OR table_name LIKE '%_TBC_%'
    ORDER BY table_name
""")
account_tables = [row['table_name'] for row in cur.fetchall()]
print(f"Found {len(account_tables)} account-specific raw tables\n")

# Check each table for our UUIDs
found_records = {}
for table in account_tables:
    for uuid in missing_uuids:
        try:
            cur.execute(f"""
                SELECT *
                FROM {table}
                WHERE uuid = %s
            """, (uuid,))
            row = cur.fetchone()
            if row:
                found_records[uuid] = {
                    'table': table,
                    'data': dict(row)
                }
        except Exception as e:
            # Table might not have all columns
            pass

print(f"2. FOUND RECORDS:")
print("-" * 80)
for uuid, info in found_records.items():
    print(f"  UUID: {uuid}")
    print(f"    Table: {info['table']}")
    data = info['data']
    print(f"    Payment ID: {data.get('payment_id', 'N/A')}")
    print(f"    Debit: {data.get('debit', 'N/A')}")
    print(f"    Credit: {data.get('credit', 'N/A')}")
    print(f"    Transaction Date: {data.get('transaction_date', 'N/A')}")
    print()

if not found_records:
    print("  NO RECORDS FOUND in any account-specific raw table!")

# 3. Try to find by payment_id instead
print("3. Looking for records by PAYMENT_ID in account tables:")
print("-" * 80)
payment_ids = ['39dbcb_5e_a9dccc', '51a575_51_bcfcf5', 'b993e2_ba_b36a2b']

for table in account_tables:
    for pid in payment_ids:
        try:
            cur.execute(f"""
                SELECT COUNT(*) as cnt, 
                       SUM(COALESCE(credit, 0) - COALESCE(debit, 0)) as total_amount
                FROM {table}
                WHERE payment_id = %s
            """, (pid,))
            row = cur.fetchone()
            if row and row['cnt'] > 0:
                print(f"  {table}:")
                print(f"    Payment ID: {pid}")
                print(f"    Count: {row['cnt']}")
                print(f"    Total Amount: {row['total_amount']}")
                print()
        except Exception as e:
            pass

conn.close()
print(f"\n{'='*80}\n")
