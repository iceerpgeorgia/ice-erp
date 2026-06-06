#!/usr/bin/env python3
"""Check what's actually in consolidated_bank_accounts for this project."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"WHAT'S ACTUALLY IN CONSOLIDATED_BANK_ACCOUNTS?")
print(f"{'='*80}\n")

# 1. Show all records for this project
print("1. All records in consolidated_bank_accounts for this project:")
print("-" * 80)
cur.execute("""
    SELECT 
        uuid,
        payment_id,
        transaction_date,
        account_currency_amount,
        nominal_amount,
        exchange_rate,
        description,
        counteragent_uuid
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    ORDER BY transaction_date, payment_id
""", (project_uuid,))
records = cur.fetchall()

print(f"Total records: {len(records)}\n")
for i, row in enumerate(records[:10], 1):  # First 10
    print(f"{i}. UUID: {row['uuid']}")
    print(f"   Payment ID: {row['payment_id']}")
    print(f"   Date: {row['transaction_date']}")
    print(f"   Account Amount: {row['account_currency_amount']}")
    print(f"   Nominal Amount: {row['nominal_amount']}")
    print(f"   Rate: {row['exchange_rate']}")
    print(f"   Description: {row['description'][:50] if row['description'] else 'N/A'}...")
    print()

# 2. Group by payment_id
print("2. Summary by payment_id:")
print("-" * 80)
cur.execute("""
    SELECT 
        payment_id,
        COUNT(*) as cnt,
        SUM(account_currency_amount) as total_account,
        SUM(nominal_amount) as total_nominal
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    GROUP BY payment_id
    ORDER BY payment_id
""", (project_uuid,))
summary = cur.fetchall()
for row in summary:
    print(f"  {row['payment_id']}:")
    print(f"    Count: {row['cnt']}")
    print(f"    Total Account: {row['total_account']}")
    print(f"    Total Nominal: {row['total_nominal']}")
    print()

# 3. Check if maybe the issue is that distributions reference the wrong table
print("3. Do the missing UUIDs exist in OTHER projects?")
print("-" * 80)
missing_uuids = [
    '6ec61407-6c08-5ccd-8847-0b4027ba9ae2',
    '1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a',
    '77501426-9a30-5b3f-842a-0270795db7c0',
    'caa2cf8c-7009-5a48-8a3c-a1385c5084e4',
    '06f762fc-3ccc-573c-8f93-c18565a717b4'
]

for uuid in missing_uuids:
    cur.execute("""
        SELECT uuid, project_uuid, payment_id, account_currency_amount
        FROM consolidated_bank_accounts
        WHERE uuid = %s
    """, (uuid,))
    row = cur.fetchone()
    if row:
        print(f"  UUID: {row['uuid']}")
        print(f"    Project: {row['project_uuid']}")
        print(f"    Payment ID: {row['payment_id']}")
        print(f"    Amount: {row['account_currency_amount']}")
        print()
else:
    if not row:
        print("  None of the UUIDs exist in consolidated_bank_accounts at all!")
        print()
        print("4. SUMMARY OF THE PROBLEM:")
        print("-" * 80)
        print("  • payments_jobs references 5 raw_record_uuids that don't exist")
        print("  • These UUIDs might be from deleted/archived records")
        print("  • OR they might be from a data migration that went wrong")
        print("  • The actual bank records for this project have different payment_ids")
        print("  • This explains the 688K GEL mismatch (528K vs -161K)")


conn.close()
print(f"\n{'='*80}\n")
