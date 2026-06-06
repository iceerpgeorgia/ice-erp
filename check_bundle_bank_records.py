#!/usr/bin/env python3
"""
Check which bundle payments (is_bundle_payment = true) have bank transaction records.
"""

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
print(f"BUNDLE PAYMENT BANK TRANSACTION CHECK")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Get all bundle payments for this project
print("1. BUNDLE PAYMENTS:")
print("-" * 80)
cur.execute("""
    SELECT 
        p.payment_id,
        p.record_uuid as payment_uuid,
        fc.code as financial_code,
        c.name as counteragent,
        cur.code as currency
    FROM payments p
    LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
    LEFT JOIN counteragents c ON c.counteragent_uuid = p.counteragent_uuid
    LEFT JOIN currencies cur ON cur.uuid = p.currency_uuid
    WHERE p.project_uuid = %s
    AND p.is_bundle_payment = TRUE
    ORDER BY fc.code
""", (project_uuid,))
bundle_payments = cur.fetchall()

print(f"Found {len(bundle_payments)} bundle payment(s):\n")
for pmt in bundle_payments:
    print(f"  {pmt['payment_id']}")
    print(f"    Financial Code: {pmt['financial_code']}")
    print(f"    Counteragent: {pmt['counteragent']}")
    print(f"    Currency: {pmt['currency']}")
    print()

# 2. Check which bundle payments have bank records
print("2. BUNDLE PAYMENTS WITH BANK RECORDS:")
print("-" * 80)

for pmt in bundle_payments:
    cur.execute("""
        SELECT 
            COUNT(*) as txn_count,
            SUM(account_currency_amount) as total_gel,
            SUM(nominal_amount) as total_nominal,
            MIN(transaction_date) as first_date,
            MAX(transaction_date) as last_date
        FROM consolidated_bank_accounts
        WHERE project_uuid = %s
        AND payment_id = %s
    """, (project_uuid, pmt['payment_id']))
    
    bank_data = cur.fetchone()
    
    if bank_data and bank_data['txn_count'] and bank_data['txn_count'] > 0:
        print(f"  ✓ {pmt['payment_id']} ({pmt['financial_code']})")
        print(f"    Transactions: {bank_data['txn_count']}")
        print(f"    Total GEL: {bank_data['total_gel']:,.2f}")
        print(f"    Total Nominal: {bank_data['total_nominal']:,.2f}")
        print(f"    Date Range: {bank_data['first_date']} to {bank_data['last_date']}")
        print()

# 3. Check if any bundle payments have existing distributions
print("3. EXISTING DISTRIBUTIONS FOR BUNDLE PAYMENTS:")
print("-" * 80)

cur.execute("""
    SELECT 
        p.payment_id,
        COUNT(pj.id) as dist_count,
        SUM(pj.amount_account_curr) as total_gel,
        SUM(pj.amount) as total_nominal
    FROM payments p
    LEFT JOIN payments_jobs pj ON pj.payment_uuid = p.record_uuid
    WHERE p.project_uuid = %s
    AND p.is_bundle_payment = TRUE
    GROUP BY p.payment_id
    HAVING COUNT(pj.id) > 0
    ORDER BY p.payment_id
""", (project_uuid,))

existing_dists = cur.fetchall()

if existing_dists:
    print(f"Found {len(existing_dists)} bundle payment(s) with existing distributions:\n")
    for dist in existing_dists:
        print(f"  {dist['payment_id']}")
        print(f"    Distributions: {dist['dist_count']}")
        print(f"    Total GEL: {dist['total_gel']:,.2f}")
        print(f"    Total Nominal: {dist['total_nominal']:,.2f}")
        print()
else:
    print("  No existing distributions found for bundle payments")

conn.close()
print(f"\n{'='*80}\n")
