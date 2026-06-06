#!/usr/bin/env python3
"""
Clean up orphaned payments_jobs distributions that reference non-existent raw records.

This script will:
1. Identify payments_jobs rows that reference raw_record_uuid values that don't exist in consolidated_bank_accounts
2. Show what will be deleted
3. Delete the orphaned rows
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"CLEANUP: Orphaned payments_jobs Distributions")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Find orphaned rows
print("1. FINDING ORPHANED DISTRIBUTIONS:")
print("-" * 80)
cur.execute("""
    SELECT 
        pj.id,
        pj.uuid,
        p.payment_id,
        pj.amount_account_curr,
        pj.amount,
        pj.raw_record_uuid,
        pj.batch_partition_uuid,
        j.job_name
    FROM payments_jobs pj
    LEFT JOIN payments p ON p.record_uuid = pj.payment_uuid
    LEFT JOIN jobs j ON j.job_uuid = pj.job_uuid
    WHERE pj.project_uuid = %s
    AND pj.raw_record_uuid IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 
        FROM consolidated_bank_accounts cba 
        WHERE cba.uuid = pj.raw_record_uuid
    )
    ORDER BY pj.id
""", (project_uuid,))
orphaned = cur.fetchall()

print(f"Found {len(orphaned)} orphaned distribution rows:\n")
total_account = 0
total_nominal = 0
for row in orphaned:
    print(f"  ID: {row['id']}")
    print(f"    Payment ID: {row['payment_id']}")
    print(f"    Job: {row['job_name']}")
    print(f"    Amount Account: {row['amount_account_curr']}")
    print(f"    Amount Nominal: {row['amount']}")
    print(f"    Raw Record UUID: {row['raw_record_uuid']}")
    print()
    total_account += float(row['amount_account_curr'] or 0)
    total_nominal += float(row['amount'] or 0)

print(f"Total Orphaned Amount (Account): {total_account:,.2f} GEL")
print(f"Total Orphaned Amount (Nominal): {total_nominal:,.2f}")
print()

# 2. Confirm deletion
print("2. CONFIRM DELETION:")
print("-" * 80)
print(f"  This will DELETE {len(orphaned)} orphaned distribution rows")
print(f"  These rows reference raw_record_uuids that don't exist in consolidated_bank_accounts")
print()
response = input("  Proceed with deletion? (yes/no): ")

if response.lower() != 'yes':
    print("\n  Aborted. No changes made.")
    conn.close()
    exit(0)

# 3. Delete orphaned rows
print("\n3. DELETING ORPHANED ROWS:")
print("-" * 80)
orphaned_ids = [row['id'] for row in orphaned]
cur.execute("""
    DELETE FROM payments_jobs
    WHERE id = ANY(%s)
""", (orphaned_ids,))
deleted_count = cur.rowcount
conn.commit()

print(f"  Deleted {deleted_count} orphaned distribution rows")

# 4. Verify the cleanup
print("\n4. VERIFICATION:")
print("-" * 80)
cur.execute("""
    SELECT COUNT(*) as cnt, 
           SUM(amount_account_curr) as total_account,
           SUM(amount) as total_nominal
    FROM payments_jobs
    WHERE project_uuid = %s
""", (project_uuid,))
remaining = cur.fetchone()

print(f"  Remaining distributions: {remaining['cnt']}")
print(f"  Total Account Amount: {remaining['total_account'] or 0:,.2f} GEL")
print(f"  Total Nominal Amount: {remaining['total_nominal'] or 0:,.2f}")
print()

# 5. Show what's left in consolidated_bank_accounts
cur.execute("""
    SELECT COUNT(*) as cnt,
           SUM(account_currency_amount) as total_account
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    AND payment_id IS NOT NULL
    AND payment_id NOT LIKE 'BTC_%%'
""", (project_uuid,))
bank_remaining = cur.fetchone()

print(f"  Bank records for this project: {bank_remaining['cnt']}")
print(f"  Bank Total Account Amount: {bank_remaining['total_account'] or 0:,.2f} GEL")
print()

mismatch = float(remaining['total_account'] or 0) - float(bank_remaining['total_account'] or 0)
print(f"  New Mismatch: {mismatch:,.2f} GEL")

conn.close()
print(f"\n{'='*80}\n")
print("CLEANUP COMPLETE!")
print()
