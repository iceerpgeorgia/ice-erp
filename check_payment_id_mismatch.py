#!/usr/bin/env python3
"""
Find payment_ids in bank transactions and see which ones have payments.
"""
import os
from decimal import Decimal
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

print("\n=== BANK TRANSACTION PAYMENT IDs ===\n")

# Get all unique payment_ids from bank transactions
print("1. Payment IDs in bank transactions:")
cur.execute("""
SELECT 
  payment_id,
  COUNT(*) as tx_count,
  SUM(CAST(account_currency_amount AS NUMERIC)) as total_amount
FROM "GE65TB7856036050100002_TBC_GEL"
WHERE project_uuid = %s
  AND payment_id IS NOT NULL
GROUP BY payment_id
ORDER BY payment_id;
""", (project_uuid,))

rows = cur.fetchall()
bank_total = Decimal('0')
bank_payment_ids = set()

for payment_id, tx_count, amount in rows:
    amount = Decimal(str(amount))
    bank_total += amount
    bank_payment_ids.add(payment_id)
    print(f"  {payment_id}: {amount} ({tx_count} transactions)")

print(f"\nTotal bank amount: {bank_total}\n")

# Get all payment_ids from payments table (income)
print("2. Income payment IDs in payments table:")
cur.execute("""
SELECT 
  p.payment_id
FROM payments p
LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
WHERE p.project_uuid = %s 
  AND fc.is_income = true
  AND p.is_active = true
ORDER BY p.payment_id;
""", (project_uuid,))

payment_ids = set()
for (payment_id,) in cur.fetchall():
    payment_ids.add(payment_id)
    print(f"  {payment_id}")

print(f"\n3. COMPARISON:")
in_bank_not_payments = bank_payment_ids - payment_ids
in_payments_not_bank = payment_ids - bank_payment_ids

if in_bank_not_payments:
    print(f"\n  Payment IDs IN BANK but NOT in PAYMENTS ({len(in_bank_not_payments)}):")
    for pid in sorted(in_bank_not_payments):
        cur.execute("""
        SELECT SUM(CAST(account_currency_amount AS NUMERIC))
        FROM "GE65TB7856036050100002_TBC_GEL"
        WHERE payment_id = %s AND project_uuid = %s;
        """, (pid, project_uuid))
        amount = cur.fetchone()[0]
        amount = Decimal(str(amount)) if amount else Decimal('0')
        print(f"    {pid}: {amount}")

if in_payments_not_bank:
    print(f"\n  Payment IDs IN PAYMENTS but NOT in BANK ({len(in_payments_not_bank)}):")
    for pid in sorted(in_payments_not_bank):
        print(f"    {pid}")

conn.close()
