#!/usr/bin/env python3
"""
Check the discrepancy between top grid (jobs table) and bottom grid (job distributions).
The jobs table Paid GEL should equal the sum from job distributions grid.
"""
import os
from decimal import Decimal
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

print("\n=== PAID GEL DISCREPANCY CHECK ===\n")

# 1. Payments-Jobs sum (what jobs table displays)
print("1. Payments-Jobs Records (Source of Top Grid - Jobs Table Paid GEL):")
cur.execute("""
SELECT 
  j.job_name,
  COALESCE(SUM(pj.amount_account_curr), 0) as paid_gel_per_job,
  COUNT(pj.uuid) as distribution_count
FROM jobs j
LEFT JOIN payments_jobs pj ON j.job_uuid = pj.job_uuid
WHERE j.project_uuid = %s AND j.is_active = true
GROUP BY j.job_uuid, j.job_name
ORDER BY j.job_name;
""", (project_uuid,))

jobs_total = Decimal('0')
for job_name, paid_gel, dist_count in cur.fetchall():
    paid_gel = Decimal(str(paid_gel))
    jobs_total += paid_gel
    print(f"  {job_name}: {paid_gel} ({dist_count} distributions)")

print(f"\n✓ TOTAL from Jobs Table: {jobs_total}\n")

# 2. Income payments list
print("2. INCOME PAYMENTS in Project:")
cur.execute("""
SELECT 
  p.uuid,
  p.payment_id,
  p.amount,
  p.amount_account_curr,
  fc.name
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.project_uuid = %s 
  AND fc.category_code_1 = '4'
  AND p.is_active = true
ORDER BY p.payment_id;
""", (project_uuid,))

income_payments_rows = cur.fetchall()
income_total = Decimal('0')
for uuid, payment_id, amount, amount_account_curr, fc_name in income_payments_rows:
    amount_account_curr = Decimal(str(amount_account_curr)) if amount_account_curr else Decimal('0')
    income_total += amount_account_curr
    print(f"  {payment_id}: {amount_account_curr} ({fc_name})")

print(f"\n✓ TOTAL Income Payments: {income_total}\n")

# 3. Comparison
print(f"3. COMPARISON:")
print(f"   Jobs Table (Sum of payments_jobs): {jobs_total}")
print(f"   Income Payments (sum of amounts):  {income_total}")
diff = income_total - jobs_total
print(f"   Difference:                        {diff}\n")

if diff == 0:
    print("✓ MATCH - Both totals are the same!")
else:
    print(f"✗ MISMATCH - Difference is {diff} GEL")
    print(f"   This suggests some income payments were not distributed to jobs\n")
    
    # Find payments without distributions
    print("4. INCOME PAYMENTS NOT FULLY DISTRIBUTED:")
    cur.execute("""
    SELECT 
      p.payment_id,
      p.amount_account_curr,
      COALESCE(SUM(pj.amount_account_curr), 0) as distributed_amount,
      (p.amount_account_curr - COALESCE(SUM(pj.amount_account_curr), 0)) as undistributed_amount
    FROM payments p
    LEFT JOIN payments_jobs pj ON p.uuid = pj.payment_uuid
    LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
    WHERE p.project_uuid = %s AND fc.category_code_1 = '4'
    GROUP BY p.uuid, p.payment_id, p.amount_account_curr
    HAVING (p.amount_account_curr - COALESCE(SUM(pj.amount_account_curr), 0)) != 0
    ORDER BY p.payment_id;
    """, (project_uuid,))
    
    rows = cur.fetchall()
    if rows:
        total_undist = Decimal('0')
        for payment_id, amount, distributed, undistributed in rows:
            amount = Decimal(str(amount))
            distributed = Decimal(str(distributed))
            undistributed = Decimal(str(undistributed))
            total_undist += undistributed
            print(f"  {payment_id}: {undistributed} undistributed (has {distributed}/{amount})")
        print(f"\n  TOTAL undistributed: {total_undist}")
    else:
        print("  None - all income payments are fully distributed")

conn.close()
