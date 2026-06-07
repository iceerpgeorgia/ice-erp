#!/usr/bin/env python3
"""
Check what amounts those 4 payments without bank matches actually have.
"""
import os
from decimal import Decimal
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

print("\n=== PAYMENTS IN TABLE BUT NOT IN BANK ===\n")

# Get details on those 4 payments
cur.execute("""
SELECT 
  p.payment_id,
  p.record_uuid,
  fc.name as fc_name,
  fc.is_income,
  p.is_active,
  SUM(COALESCE(pl.accrual, 0) + COALESCE(pl."order", 0)) as ledger_total
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
LEFT JOIN payments_ledger pl ON p.payment_id = pl.payment_id AND (pl.is_deleted = false OR pl.is_deleted IS NULL)
WHERE p.project_uuid = %s 
  AND fc.is_income = true
  AND p.payment_id IN ('4a7383_56_ac88eb', '4ad91b_a1_8cfceb', '51a575_51_bcfcf5', 'a009b1_ec_8a072a')
GROUP BY p.payment_id, p.record_uuid, fc.name, fc.is_income, p.is_active
ORDER BY p.payment_id;
""", (project_uuid,))

rows = cur.fetchall()
for payment_id, record_uuid, fc_name, is_income, is_active, ledger_total in rows:
    ledger_total = Decimal(str(ledger_total)) if ledger_total else Decimal('0')
    print(f"{payment_id}:")
    print(f"  FC: {fc_name} (is_income={is_income})")
    print(f"  Active: {is_active}")
    print(f"  Ledger Total: {ledger_total}")
    
    # Check payments_jobs for this payment
    cur.execute("""
    SELECT SUM(amount_account_curr)
    FROM payments_jobs
    WHERE payment_uuid = %s;
    """, (record_uuid,))
    
    pj_total = cur.fetchone()[0]
    pj_total = Decimal(str(pj_total)) if pj_total else Decimal('0')
    print(f"  Payments_Jobs Total: {pj_total}\n")

conn.close()
