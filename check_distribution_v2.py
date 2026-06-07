#!/usr/bin/env python3
"""
Check for partially or undistributed transactions that could explain the discrepancy.
"""
import os
from decimal import Decimal
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

print("\n=== PAYMENT DISTRIBUTION COMPLETENESS ===\n")

# Get all income payments for this project and check distributions
print("1. INCOME PAYMENTS and their distributions:")
cur.execute("""
SELECT 
  p.payment_id,
  SUM(pj.amount_account_curr) as total_distributed,
  COUNT(DISTINCT pj.uuid) as distribution_count,
  STRING_AGG(DISTINCT j.job_name, ', ') as jobs
FROM payments p
LEFT JOIN payments_jobs pj ON p.record_uuid = pj.payment_uuid
LEFT JOIN jobs j ON pj.job_uuid = j.job_uuid
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.project_uuid = %s 
  AND fc.is_income = true
  AND p.is_active = true
GROUP BY p.payment_id
ORDER BY p.payment_id;
""", (project_uuid,))

rows = cur.fetchall()
total_distributed = Decimal('0')

for payment_id, distributed, dist_count, jobs in rows:
    distributed = Decimal(str(distributed)) if distributed else Decimal('0')
    total_distributed += distributed
    print(f"  {payment_id}: {distributed} ({dist_count} distributions)")
    if jobs:
        print(f"    → {jobs}")

print(f"\n✓ TOTAL distributed: {total_distributed}\n")

# Compare with the bank transactions total
print("2. BANK TRANSACTION TOTALS:")
cur.execute("""
SELECT 
  COUNT(*) as tx_count,
  SUM(CAST(account_currency_amount AS NUMERIC)) as total_amount
FROM "GE65TB7856036050100002_TBC_GEL"
WHERE project_uuid = %s
  AND payment_id IS NOT NULL;
""", (project_uuid,))

tx_count, bank_total = cur.fetchone()
bank_total = Decimal(str(bank_total)) if bank_total else Decimal('0')

print(f"  Bank Transactions: {bank_total} ({tx_count} rows)")
print(f"  Distributed: {total_distributed}")
print(f"  Difference: {bank_total - total_distributed}\n")

if abs(bank_total - total_distributed) < 0.01:
    print("✓ MATCHED - Bank total equals distributed total")
else:
    print(f"✗ MISMATCH - Difference of {bank_total - total_distributed}")

conn.close()
