#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Get the income payment records with their payment_ids
cur.execute('''
SELECT p.record_uuid, p.payment_id, fc.is_income
FROM payments p
LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
WHERE p.project_uuid = %s::uuid
ORDER BY fc.is_income DESC, p.payment_id
''', (project_uuid,))

payments = cur.fetchall()
print(f"Payments for project (total: {len(payments)}):")
for record_uuid, payment_id, is_income in payments[:20]:  # First 20
    print(f"  {'INCOME' if is_income else 'EXPENSE'}: {payment_id}")

# Now check what raw transactions exist for these payments
income_pids = [p[1] for p in payments if p[2]]
print(f"\nIncome payment IDs: {income_pids}")
print()

# Check raw tables for these payment_ids
cur.execute('''
SELECT COUNT(*), SUM(account_currency_amount)
FROM (
  SELECT payment_id, account_currency_amount FROM "GE78BG0000000893486000_BOG_GEL"
  WHERE payment_id = ANY(%s)
  UNION ALL
  SELECT payment_id, account_currency_amount FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE payment_id = ANY(%s)
) t
''', (income_pids, income_pids))

count, total = cur.fetchone()
print(f"Raw transactions with these payment_ids: {count}")
print(f"Total GEL: {total}")

conn.close()
