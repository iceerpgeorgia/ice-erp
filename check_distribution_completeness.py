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

print("\n=== TRANSACTION DISTRIBUTION ANALYSIS ===\n")

# Get all income payments for this project
print("1. INCOME PAYMENTS for project:")
cur.execute("""
SELECT 
  p.payment_id,
  p.amount_account_curr,
  SUM(pj.amount_account_curr) as distributed_amount,
  (p.amount_account_curr - COALESCE(SUM(pj.amount_account_curr), 0)) as undistributed
FROM payments p
LEFT JOIN payments_jobs pj ON p.record_uuid = pj.payment_uuid
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.project_uuid = %s AND fc.category_code_1 = '4'
GROUP BY p.id, p.payment_id, p.amount_account_curr
ORDER BY p.payment_id;
""", (project_uuid,))

rows = cur.fetchall()
payment_total = Decimal('0')
distributed_total = Decimal('0')
undistributed_total = Decimal('0')
partially_distributed = []

for payment_id, amount, distributed, undistributed in rows:
    amount = Decimal(str(amount)) if amount else Decimal('0')
    distributed = Decimal(str(distributed)) if distributed else Decimal('0')
    undistributed = Decimal(str(undistributed)) if undistributed else Decimal('0')
    
    payment_total += amount
    distributed_total += distributed
    undistributed_total += undistributed
    
    if amount != 0:
        print(f"  {payment_id}:")
        print(f"    Total: {amount}")
        print(f"    Distributed: {distributed}")
        print(f"    Undistributed: {undistributed}")
        if undistributed != 0:
            partially_distributed.append((payment_id, amount, distributed, undistributed))

print(f"\nTotals:")
print(f"  Payment Amounts: {payment_total}")
print(f"  Distributed: {distributed_total}")
print(f"  Undistributed: {undistributed_total}")

if partially_distributed:
    print(f"\n2. {len(partially_distributed)} PAYMENTS NOT FULLY DISTRIBUTED:")
    for payment_id, total, distributed, undist in partially_distributed:
        pct = float((distributed / total * 100)) if total != 0 else 0
        print(f"  {payment_id}: {undist} undist ({pct:.1f}% distributed)")
else:
    print("\n2. All payments are FULLY distributed")

# Check if the undistributed amount matches the grid discrepancy
print(f"\n3. DISCREPANCY CHECK:")
print(f"   Undistributed amount: {undistributed_total}")
print(f"   Reported grid difference: 8.57 GEL")
if abs(float(undistributed_total) - 8.57) < 0.01:
    print(f"   ✓ MATCH - The undistributed 8.57 GEL explains the difference!")
else:
    print(f"   ✗ NO MATCH - Undistributed amount is {undistributed_total}, not 8.57")

conn.close()
