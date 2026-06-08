#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Get income FC UUIDs
cur.execute('SELECT uuid FROM financial_codes WHERE is_income = true')
income_fc_uuids = [row[0] for row in cur.fetchall()]
print(f'Income FCs: {len(income_fc_uuids)}')

# Get the 5 transactions with income FCs
cur.execute('''
SELECT uuid, payment_id, account_currency_amount, nominal_amount, 'GE78' as tbl
FROM "GE78BG0000000893486000_BOG_GEL"
WHERE project_uuid = %s::uuid AND financial_code_uuid = ANY(%s::uuid[])
UNION ALL
SELECT uuid, payment_id, account_currency_amount, nominal_amount, 'TBC' as tbl
FROM "GE65TB7856036050100002_TBC_GEL"
WHERE project_uuid = %s::uuid AND financial_code_uuid = ANY(%s::uuid[])
ORDER BY payment_id
''', (project_uuid, income_fc_uuids, project_uuid, income_fc_uuids))

txs = cur.fetchall()
print(f'Transactions with income FC: {len(txs)}')
for uuid, payment_id, account_curr, nominal, tbl in txs:
    print(f'  {tbl}: {uuid[:8]}... payment_id={payment_id} acc_curr={account_curr} nominal={nominal}')

# Now check distributions for these transactions
raw_uuids = [row[0] for row in txs]
print(f'\nDistributions for these raw UUIDs:')

cur.execute('''
SELECT 
  pj.raw_record_uuid,
  pj.batch_partition_uuid,
  SUM(pj.amount_account_curr) as total_dist,
  COUNT(*) as dist_count
FROM payments_jobs pj
WHERE pj.raw_record_uuid::text = ANY(%s::text[])
  OR pj.batch_partition_uuid::text = ANY(%s::text[])
GROUP BY pj.raw_record_uuid, pj.batch_partition_uuid
''', (raw_uuids, raw_uuids))

dist_rows = cur.fetchall()
total_dist = 0
for raw_uuid, batch_uuid, dist_total, dist_count in dist_rows:
    print(f'  raw_uuid={raw_uuid} batch_uuid={batch_uuid} total_dist={dist_total} count={dist_count}')
    if dist_total:
        total_dist += float(dist_total)

print(f'\nTotal distributed: {total_dist}')
print(f'Raw total: 528018.60')
print(f'Gap: {528018.60 - total_dist:.2f}')

conn.close()
