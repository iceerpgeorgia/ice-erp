#!/usr/bin/env python3
"""Investigate bundle payments and job distribution structure."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"BUNDLE PAYMENTS & JOB DISTRIBUTION STRUCTURE")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Check if there are any payment bundles for this project
print("1. PAYMENT BUNDLES for this project:")
print("-" * 80)
cur.execute("""
    SELECT 
        pb.uuid,
        pb.label,
        pb.created_at,
        COUNT(DISTINCT p.payment_id) as payment_count
    FROM payments p
    JOIN payment_bundles pb ON p.payment_bundle_uuid = pb.uuid
    WHERE p.project_uuid = %s
    AND p.payment_bundle_uuid IS NOT NULL
    GROUP BY pb.uuid, pb.label, pb.created_at
    ORDER BY pb.created_at
""", (project_uuid,))
bundles = cur.fetchall()

if bundles:
    print(f"Found {len(bundles)} payment bundle(s):\n")
    for bundle in bundles:
        print(f"  Bundle UUID: {bundle['uuid']}")
        print(f"    Label: {bundle['label']}")
        print(f"    Payments: {bundle['payment_count']}")
        print(f"    Created: {bundle['created_at']}")
        print()
else:
    print("  No payment bundles found for this project\n")

# 2. Check all payments for this project
print("2. ALL PAYMENTS for this project:")
print("-" * 80)
cur.execute("""
    SELECT 
        p.payment_id,
        p.is_bundle_payment,
        p.payment_bundle_uuid,
        fc.code as financial_code,
        c.name as counteragent,
        cur.code as currency
    FROM payments p
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    LEFT JOIN counteragents c ON c.counteragent_uuid = p.counteragent_uuid
    LEFT JOIN currencies cur ON cur.uuid = p.currency_uuid
    WHERE p.project_uuid = %s
    ORDER BY p.payment_id
""", (project_uuid,))
payments = cur.fetchall()

print(f"Found {len(payments)} payment(s):\n")
for pmt in payments:
    print(f"  {pmt['payment_id']}")
    print(f"    Financial Code: {pmt['financial_code']}")
    print(f"    Counteragent: {pmt['counteragent']}")
    print(f"    Currency: {pmt['currency']}")
    print(f"    Is Bundle Payment: {pmt['is_bundle_payment']}")
    print(f"    Bundle UUID: {pmt['payment_bundle_uuid']}")
    print()

# 3. Check jobs for this project
print("3. JOBS for this project:")
print("-" * 80)
cur.execute("""
    SELECT job_uuid, job_name, selling_price, weight
    FROM jobs
    WHERE project_uuid = %s
    ORDER BY job_name
""", (project_uuid,))
jobs = cur.fetchall()

print(f"Found {len(jobs)} job(s):\n")
total_weight = 0
for job in jobs:
    print(f"  {job['job_name']}")
    print(f"    UUID: {job['job_uuid']}")
    print(f"    Selling Price: {job['selling_price']}")
    print(f"    Weight: {job['weight']}")
    print()
    if job['weight']:
        total_weight += float(job['weight'])

if total_weight > 0:
    print(f"  Total Weight: {total_weight}")
    print()

# 4. Check bundle distribution percentages
print("4. BUNDLE DISTRIBUTION (project_bundle_payments):")
print("-" * 80)
cur.execute("""
    SELECT 
        pbp.financial_code_uuid,
        fc.code as financial_code,
        pbp.percentage
    FROM project_bundle_payments pbp
    LEFT JOIN financial_codes fc ON fc.uuid = pbp.financial_code_uuid
    WHERE pbp.project_uuid = %s
    ORDER BY fc.code
""", (project_uuid,))
bundle_dist = cur.fetchall()

if bundle_dist:
    print(f"Found {len(bundle_dist)} bundle distribution rule(s):\n")
    total_pct = 0
    for rule in bundle_dist:
        print(f"  Financial Code: {rule['financial_code']}")
        print(f"    Percentage: {rule['percentage']}%")
        print()
        if rule['percentage']:
            total_pct += float(rule['percentage'])
    print(f"  Total: {total_pct}%")
else:
    print("  No bundle distribution rules found")

print()

# 5. Show the bank transactions that need distribution
print("5. BANK TRANSACTIONS needing distribution:")
print("-" * 80)
cur.execute("""
    SELECT 
        payment_id,
        COUNT(*) as txn_count,
        SUM(account_currency_amount) as total_gel,
        SUM(nominal_amount) as total_nominal,
        MIN(transaction_date) as first_date,
        MAX(transaction_date) as last_date
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    AND payment_id IS NOT NULL
    AND payment_id NOT LIKE 'BTC_%%'
    GROUP BY payment_id
    ORDER BY payment_id
""", (project_uuid,))
bank_txns = cur.fetchall()

print(f"Found {len(bank_txns)} payment ID(s) with bank transactions:\n")
for txn in bank_txns:
    print(f"  {txn['payment_id']}")
    print(f"    Transactions: {txn['txn_count']}")
    print(f"    Total GEL: {txn['total_gel']}")
    print(f"    Total Nominal: {txn['total_nominal']}")
    print(f"    Date Range: {txn['first_date']} to {txn['last_date']}")
    print()

conn.close()
print(f"\n{'='*80}\n")
