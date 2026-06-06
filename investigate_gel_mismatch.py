#!/usr/bin/env python3
"""Investigate GEL amount mismatch between payments_jobs and bank tables."""

import os
import psycopg2
import psycopg2.extras
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"INVESTIGATING PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Get total from payments_jobs (distribution table)
print("1. PAYMENTS_JOBS (Distribution) Totals:")
print("-" * 80)
cur.execute("""
    SELECT 
        COUNT(*) as row_count,
        SUM(amount_account_curr) as total_account_curr,
        SUM(amount) as total_nominal,
        COUNT(DISTINCT payment_uuid) as unique_payments,
        COUNT(DISTINCT job_uuid) as unique_jobs
    FROM payments_jobs
    WHERE project_uuid = %s
""", (project_uuid,))
dist_totals = cur.fetchone()
print(f"  Rows: {dist_totals['row_count']}")
print(f"  Total Account Currency (GEL): {dist_totals['total_account_curr']}")
print(f"  Total Nominal Currency: {dist_totals['total_nominal']}")
print(f"  Unique Payments: {dist_totals['unique_payments']}")
print(f"  Unique Jobs: {dist_totals['unique_jobs']}")

# 2. Sample some rows to see the data
print("\n2. SAMPLE PAYMENTS_JOBS Rows (first 5):")
print("-" * 80)
cur.execute("""
    SELECT 
        pj.payment_uuid,
        pj.job_uuid,
        pj.amount_account_curr,
        pj.amount,
        pj.batch_partition_uuid,
        pj.raw_record_uuid,
        p.payment_id
    FROM payments_jobs pj
    LEFT JOIN payments p ON p.record_uuid = pj.payment_uuid
    WHERE pj.project_uuid = %s
    ORDER BY pj.created_at
    LIMIT 5
""", (project_uuid,))
samples = cur.fetchall()
for row in samples:
    print(f"  Payment ID: {row['payment_id']}")
    print(f"    Amount Account Curr: {row['amount_account_curr']}")
    print(f"    Amount (Nominal): {row['amount']}")
    print(f"    Batch Partition: {row['batch_partition_uuid']}")
    print(f"    Raw Record: {row['raw_record_uuid']}")
    print()

# 3. Get totals from consolidated_bank_accounts (raw bank table)
print("3. CONSOLIDATED_BANK_ACCOUNTS (Raw Bank) Totals:")
print("-" * 80)
cur.execute("""
    SELECT 
        COUNT(*) as row_count,
        SUM(account_currency_amount) as total_account_curr,
        SUM(nominal_amount) as total_nominal_curr,
        COUNT(DISTINCT payment_id) as unique_payment_ids
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    AND payment_id IS NOT NULL
    AND payment_id NOT LIKE 'BTC_%%'
""", (project_uuid,))
bank_totals = cur.fetchone()
print(f"  Rows: {bank_totals['row_count']}")
print(f"  Total Account Currency (GEL): {bank_totals['total_account_curr']}")
print(f"  Total Nominal Currency: {bank_totals['total_nominal_curr']}")
print(f"  Unique Payment IDs: {bank_totals['unique_payment_ids']}")

# 4. Get payment IDs from both sides and compare
print("\n4. PAYMENT ID COMPARISON:")
print("-" * 80)

# Payment IDs in distributions
cur.execute("""
    SELECT DISTINCT p.payment_id
    FROM payments_jobs pj
    JOIN payments p ON p.record_uuid = pj.payment_uuid
    WHERE pj.project_uuid = %s
    AND p.payment_id IS NOT NULL
    ORDER BY p.payment_id
""", (project_uuid,))
dist_payment_ids = {row['payment_id'] for row in cur.fetchall()}

# Payment IDs in bank
cur.execute("""
    SELECT DISTINCT payment_id
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    AND payment_id IS NOT NULL
    AND payment_id NOT LIKE 'BTC_%%'
    ORDER BY payment_id
""", (project_uuid,))
bank_payment_ids = {row['payment_id'] for row in cur.fetchall()}

print(f"  Payment IDs in distributions: {len(dist_payment_ids)}")
print(f"  Payment IDs in bank: {len(bank_payment_ids)}")
print(f"  In both: {len(dist_payment_ids & bank_payment_ids)}")
print(f"  Only in distributions: {len(dist_payment_ids - bank_payment_ids)}")
print(f"  Only in bank: {len(bank_payment_ids - dist_payment_ids)}")

if dist_payment_ids - bank_payment_ids:
    print(f"\n  Payment IDs only in distributions:")
    for pid in sorted(dist_payment_ids - bank_payment_ids)[:10]:
        print(f"    - {pid}")

if bank_payment_ids - dist_payment_ids:
    print(f"\n  Payment IDs only in bank (first 10):")
    for pid in sorted(bank_payment_ids - dist_payment_ids)[:10]:
        print(f"    - {pid}")

# 5. Check for rows where amount_account_curr might be wrong (equals nominal despite rate != 1)
print("\n5. POTENTIAL STALE EQUIVALENT AMOUNTS:")
print("-" * 80)
cur.execute("""
    SELECT 
        pj.id,
        p.payment_id,
        pj.amount_account_curr,
        pj.amount,
        pj.batch_partition_uuid,
        pj.raw_record_uuid,
        CASE 
            WHEN pj.batch_partition_uuid IS NOT NULL THEN 
                (SELECT cba.exchange_rate FROM bank_transaction_batches btb 
                 JOIN consolidated_bank_accounts cba ON cba.uuid::text = btb.raw_record_uuid
                 WHERE btb.uuid = pj.batch_partition_uuid
                 LIMIT 1)
            WHEN pj.raw_record_uuid IS NOT NULL THEN
                (SELECT exchange_rate FROM consolidated_bank_accounts 
                 WHERE uuid = pj.raw_record_uuid)
            ELSE NULL
        END as bank_rate
    FROM payments_jobs pj
    LEFT JOIN payments p ON p.record_uuid = pj.payment_uuid
    WHERE pj.project_uuid = %s
    AND pj.amount_account_curr = pj.amount
    LIMIT 20
""", (project_uuid,))
stale_rows = cur.fetchall()
print(f"  Found {len(stale_rows)} rows where account_curr = nominal")
if stale_rows:
    for row in stale_rows[:5]:
        print(f"  Payment ID: {row['payment_id']}")
        print(f"    Amount: {row['amount_account_curr']} (both account and nominal)")
        print(f"    Bank Rate: {row['bank_rate']}")
        print()

# 6. Calculate the mismatch
print("\n6. MISMATCH ANALYSIS:")
print("-" * 80)
dist_total = dist_totals['total_account_curr'] or Decimal('0')
bank_total = bank_totals['total_account_curr'] or Decimal('0')
mismatch = dist_total - bank_total
print(f"  Distribution Total (GEL): {dist_total:,.2f}")
print(f"  Bank Total (GEL): {bank_total:,.2f}")
print(f"  Mismatch: {mismatch:,.2f}")
if mismatch != 0:
    pct = (mismatch / bank_total * 100) if bank_total else 0
    print(f"  Mismatch %: {pct:.2f}%")

conn.close()
print(f"\n{'='*80}\n")
