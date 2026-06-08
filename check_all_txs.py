#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Count ALL transactions
cur.execute('''
SELECT COUNT(*), SUM(account_currency_amount), SUM(nominal_amount)
FROM (
  SELECT account_currency_amount, nominal_amount FROM "GE78BG0000000893486000_BOG_GEL"
  WHERE project_uuid = %s::uuid
  UNION ALL
  SELECT account_currency_amount, nominal_amount FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE project_uuid = %s::uuid
) t
''', (project_uuid, project_uuid))

count, acc_sum, nom_sum = cur.fetchone()
print(f'ALL transactions for project: {count}')
print(f'  Total account currency: {acc_sum}')
print(f'  Total nominal: {nom_sum}')

# Check by financial_code.is_income
cur.execute('SELECT uuid FROM financial_codes WHERE is_income = true')
income_fc_uuids = [row[0] for row in cur.fetchall()]
print(f'\nIncome FCs: {len(income_fc_uuids)}')

cur.execute('''
SELECT COUNT(*), SUM(account_currency_amount), SUM(nominal_amount)
FROM (
  SELECT account_currency_amount, nominal_amount FROM "GE78BG0000000893486000_BOG_GEL"
  WHERE project_uuid = %s::uuid AND financial_code_uuid = ANY(%s::uuid[])
  UNION ALL
  SELECT account_currency_amount, nominal_amount FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE project_uuid = %s::uuid AND financial_code_uuid = ANY(%s::uuid[])
) t
''', (project_uuid, income_fc_uuids, project_uuid, income_fc_uuids))

count, acc_sum, nom_sum = cur.fetchone()
print(f'Transactions with income FCs: {count}')
print(f'  Total account currency: {acc_sum}')
print(f'  Total nominal: {nom_sum}')

conn.close()
