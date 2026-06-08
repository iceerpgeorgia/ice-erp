#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Get income payment IDs
cur.execute('''
SELECT DISTINCT p.payment_id 
FROM payments p
WHERE p.project_uuid = %s::uuid
  AND EXISTS (
    SELECT 1 FROM financial_codes fc
    WHERE fc.uuid = p.financial_code_uuid
    AND fc.is_income = true
  )
''', (project_uuid,))

income_payment_ids = list([row[0] for row in cur.fetchall()])
print(f'Income payment IDs: {len(income_payment_ids)} total\n')

# Sum raw transactions
cur.execute('''
SELECT 
  COALESCE(SUM(account_currency_amount), 0) as raw_sum_gel,
  COALESCE(SUM(nominal_amount), 0) as raw_sum_nominal,
  COUNT(*) as raw_count
FROM (
  SELECT account_currency_amount, nominal_amount FROM "GE78BG0000000893486000_BOG_GEL"
  WHERE project_uuid = %s::uuid AND payment_id = ANY(%s)
  UNION ALL
  SELECT account_currency_amount, nominal_amount FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE project_uuid = %s::uuid AND payment_id = ANY(%s)
) raw
''', (project_uuid, income_payment_ids, project_uuid, income_payment_ids))

raw_gel, raw_nom, raw_count = cur.fetchone()
print(f'Raw bank transactions: {raw_count} items')
print(f'  Total GEL (account_currency): {raw_gel}')
print(f'  Total Nominal: {raw_nom}')
print()

# Sum payments_jobs distributions  
cur.execute('''
SELECT 
  COALESCE(SUM(amount_account_curr), 0) as pj_sum_gel,
  COALESCE(SUM(amount), 0) as pj_sum_nominal,
  COUNT(*) as pj_count
FROM payments_jobs pj
WHERE pj.payment_uuid IN (
  SELECT p.record_uuid FROM payments p
  WHERE p.project_uuid = %s::uuid
    AND EXISTS (
      SELECT 1 FROM financial_codes fc
      WHERE fc.uuid = p.financial_code_uuid
      AND fc.is_income = true
    )
)
''', (project_uuid,))

pj_gel, pj_nom, pj_count = cur.fetchone()
print(f'Payments-Jobs distributions: {pj_count} items')
print(f'  Total GEL: {pj_gel}')
print(f'  Total Nominal: {pj_nom}')
print()

print(f'GAP (GEL):     {float(raw_gel) - float(pj_gel):.2f}')
print(f'GAP (Nominal): {float(raw_nom) - float(pj_nom):.2f}')

conn.close()
