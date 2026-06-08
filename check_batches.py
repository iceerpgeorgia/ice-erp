#!/usr/bin/env python3
"""Find bank transactions with incomplete distributions (including batched)"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Get all income payment IDs
cur.execute("""
SELECT DISTINCT p.payment_id 
FROM payments p
WHERE p.project_uuid = %s::uuid
  AND EXISTS (
    SELECT 1 FROM financial_codes fc
    WHERE fc.uuid = p.financial_code_uuid
    AND fc.is_income = true
  )
""", (project_uuid,))

income_payment_ids = list([row[0] for row in cur.fetchall()])
print(f"Found {len(income_payment_ids)} income payment IDs: {income_payment_ids}\n")

# Check BATCHED transactions
print("=== CHECKING BATCHED TRANSACTIONS ===")
cur.execute("""
WITH tx AS (
  SELECT raw.uuid, raw.payment_id, raw.nominal_amount, raw.account_currency_amount, 'GE78BG0000000893486000_BOG_GEL' as tbl
  FROM "GE78BG0000000893486000_BOG_GEL" raw
  WHERE raw.project_uuid = %s::uuid 
    AND raw.payment_id = ANY(%s::text[])
    AND EXISTS (SELECT 1 FROM bank_transaction_batches b WHERE b.raw_record_uuid::text = raw.uuid::text)
  UNION ALL
  SELECT raw.uuid, raw.payment_id, raw.nominal_amount, raw.account_currency_amount, 'GE65TB7856036050100002_TBC_GEL' as tbl
  FROM "GE65TB7856036050100002_TBC_GEL" raw
  WHERE raw.project_uuid = %s::uuid 
    AND raw.payment_id = ANY(%s::text[])
    AND EXISTS (SELECT 1 FROM bank_transaction_batches b WHERE b.raw_record_uuid::text = raw.uuid::text)
)
SELECT 
  tx.uuid,
  tx.tbl,
  tx.payment_id,
  tx.nominal_amount,
  tx.account_currency_amount,
  COALESCE(SUM(pj.amount), 0) as dist_nominal,
  COALESCE(SUM(pj.amount_account_curr), 0) as dist_account_curr
FROM tx
LEFT JOIN payments_jobs pj ON pj.raw_record_uuid::text = tx.uuid::text
GROUP BY tx.uuid, tx.tbl, tx.payment_id, tx.nominal_amount, tx.account_currency_amount
ORDER BY tx.payment_id
""", (project_uuid, income_payment_ids, project_uuid, income_payment_ids))

rows = cur.fetchall()
print(f"Found {len(rows)} batched transactions:\n")

for row in rows:
    uuid, tbl, payment_id, nominal, account_curr, dist_nom, dist_acc = row
    print(f"  UUID: {uuid}")
    print(f"    Nominal: {nominal} → distributed {dist_nom}")
    print(f"    Account: {account_curr} → distributed {dist_acc}")
    print()

# Check batch PARTITIONS (resolvable payment IDs)
print("\n=== CHECKING BATCH PARTITION DISTRIBUTIONS ===")
cur.execute("""
SELECT 
  b.id,
  b.raw_record_uuid,
  b.payment_id as batch_id,
  COUNT(*) as partition_count,
  COALESCE(SUM(pj.amount), 0) as total_dist_nominal,
  COALESCE(SUM(pj.amount_account_curr), 0) as total_dist_account_curr
FROM bank_transaction_batches b
LEFT JOIN bank_transaction_batch_partitions bp ON bp.batch_id = b.id
LEFT JOIN payments_jobs pj ON pj.batch_partition_uuid::text = bp.uuid::text
WHERE b.raw_record_uuid::text IN (
  SELECT uuid::text FROM "GE78BG0000000893486000_BOG_GEL" 
  WHERE project_uuid = %s::uuid AND payment_id = ANY(%s::text[])
  UNION ALL
  SELECT uuid::text FROM "GE65TB7856036050100002_TBC_GEL"
  WHERE project_uuid = %s::uuid AND payment_id = ANY(%s::text[])
)
GROUP BY b.id, b.raw_record_uuid, b.payment_id
ORDER BY b.payment_id
""", (project_uuid, income_payment_ids, project_uuid, income_payment_ids))

rows = cur.fetchall()
print(f"Found {len(rows)} batches:\n")

total_gap = 0.0
for row in rows:
    batch_id, raw_uuid, batch_payment_id, part_count, total_dist_nom, total_dist_acc = row
    print(f"  Batch: {batch_payment_id}")
    print(f"    Raw UUID: {raw_uuid}")
    print(f"    Partitions: {part_count}")
    print(f"    Total distributed (nom): {total_dist_nom}")
    print(f"    Total distributed (acc): {total_dist_acc}")
    print()

conn.close()
