#!/usr/bin/env python3
"""
Check for ANY income bank transactions (FC 1.x.x.x) for this project.
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
print(f"INCOME TRANSACTION CHECK (FC 1.x.x.x)")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# Check for any transactions with financial code starting with 1
cur.execute("""
    SELECT 
        cba.payment_id,
        fc.code as financial_code,
        COUNT(*) as txn_count,
        SUM(cba.account_currency_amount) as total_gel,
        SUM(cba.nominal_amount) as total_nominal
    FROM consolidated_bank_accounts cba
    LEFT JOIN financial_codes fc ON fc.uuid = cba.financial_code_uuid
    WHERE cba.project_uuid = %s
    AND fc.code LIKE '1%%'
    GROUP BY cba.payment_id, fc.code
    ORDER BY fc.code, cba.payment_id
""", (project_uuid,))

income_txns = cur.fetchall()

if income_txns:
    print(f"Found {len(income_txns)} income payment ID(s) with transactions:\n")
    for txn in income_txns:
        print(f"  Payment ID: {txn['payment_id'] or 'NULL'}")
        print(f"    Financial Code: {txn['financial_code']}")
        print(f"    Transactions: {txn['txn_count']}")
        print(f"    Total GEL: {txn['total_gel']:,.2f}")
        print(f"    Total Nominal: {txn['total_nominal']:,.2f}")
        print()
else:
    print("  ✗ No income transactions (FC 1.x.x.x) found for this project")
    print()

# Also check what financial codes are represented
print("\nALL FINANCIAL CODES in bank records for this project:")
print("-" * 80)
cur.execute("""
    SELECT 
        fc.code as financial_code,
        COUNT(*) as txn_count,
        SUM(cba.account_currency_amount) as total_gel
    FROM consolidated_bank_accounts cba
    LEFT JOIN financial_codes fc ON fc.uuid = cba.financial_code_uuid
    WHERE cba.project_uuid = %s
    GROUP BY fc.code
    ORDER BY fc.code
""", (project_uuid,))

all_fcs = cur.fetchall()

for fc in all_fcs:
    print(f"  {fc['financial_code']}")
    print(f"    Transactions: {fc['txn_count']}, Total GEL: {fc['total_gel']:,.2f}")

conn.close()
print(f"\n{'='*80}\n")
