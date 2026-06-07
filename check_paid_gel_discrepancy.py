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

# 2. Bank transactions sum (what job distributions grid displays)
print("2. Bank Transactions (Source of Bottom Grid - Job Distributions Grid Amount):")
cur.execute("""
SELECT COUNT(*) as tx_count, COALESCE(SUM(CAST(account_currency_amount AS NUMERIC)), 0) as total_amount
FROM "GE65TB7856036050100002_TBC_GEL"
WHERE project_uuid = %s AND payment_id IS NOT NULL;
""", (project_uuid,))
tx_count, tx_amount = cur.fetchone()
tx_amount = Decimal(str(tx_amount))
print(f"  GE65TB7856036050100002_TBC_GEL: {tx_amount} ({tx_count} transactions)")

print(f"\n✓ TOTAL from Bank Transactions: {tx_amount}\n")

# 3. Comparison
print("3. COMPARISON:")
print(f"   Top Grid (Jobs Paid GEL):         {jobs_total}")
print(f"   Bottom Grid (Bank TX Amount):     {tx_amount}")
diff = tx_amount - jobs_total
print(f"   Difference:                       {diff}\n")

if diff == 0:
    print("✓ MATCH - Both grids have same total!")
else:
    print(f"✗ MISMATCH - Difference is {diff} GEL")
    print(f"   This could be due to:")
    print(f"   - Incomplete distributions (some TX not allocated to jobs)")
    print(f"   - Rounding errors in distribution calculations")
    print(f"   - Filtering differences between the two grids\n")
    
    # Find undistributed transactions
    print("4. UNDISTRIBUTED BANK TRANSACTIONS:")
    cur.execute("""
    SELECT COUNT(*) as undist_count, COALESCE(SUM(CAST(account_currency_amount AS NUMERIC)), 0) as undist_amount
    FROM "GE65TB7856036050100002_TBC_GEL" t
    WHERE t.project_uuid = %s 
      AND t.payment_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM payments_jobs pj 
        WHERE pj.raw_record_uuid = t.uuid
      );
    """, (project_uuid,))
    undist_count, undist_amount = cur.fetchone()
    undist_amount = Decimal(str(undist_amount))
    print(f"   Found {undist_count} transactions not in distributions")
    print(f"   Total undistributed amount: {undist_amount}")

conn.close()
