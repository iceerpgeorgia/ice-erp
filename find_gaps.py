#!/usr/bin/env python3
"""Find bank transactions with incomplete distributions (gaps)"""

import os
import psycopg2
import json
from decimal import Decimal
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

income_payment_ids = tuple([row[0] for row in cur.fetchall()])
print(f"Found {len(income_payment_ids)} income payment IDs")

# Query all non-batched transactions with their distributions
cur.execute("""
WITH tx AS (
  SELECT raw.uuid, raw.payment_id, raw.nominal_amount, raw.account_currency_amount, 'GE78BG0000000893486000_BOG_GEL' as tbl
  FROM "GE78BG0000000893486000_BOG_GEL" raw
  WHERE raw.project_uuid = %s::uuid 
    AND raw.payment_id = ANY(%s::text[])
    AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches b WHERE b.raw_record_uuid::text = raw.uuid::text)
  UNION ALL
  SELECT raw.uuid, raw.payment_id, raw.nominal_amount, raw.account_currency_amount, 'GE65TB7856036050100002_TBC_GEL' as tbl
  FROM "GE65TB7856036050100002_TBC_GEL" raw
  WHERE raw.project_uuid = %s::uuid 
    AND raw.payment_id = ANY(%s::text[])
    AND NOT EXISTS (SELECT 1 FROM bank_transaction_batches b WHERE b.raw_record_uuid::text = raw.uuid::text)
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
HAVING 
  ABS(COALESCE(tx.nominal_amount, 0) - COALESCE(SUM(pj.amount), 0)) > 0.01
  OR ABS(COALESCE(tx.account_currency_amount, 0) - COALESCE(SUM(pj.amount_account_curr), 0)) > 0.01
ORDER BY ABS(COALESCE(tx.account_currency_amount, 0) - COALESCE(SUM(pj.amount_account_curr), 0)) DESC
""", (project_uuid, list(income_payment_ids), project_uuid, list(income_payment_ids)))

rows = cur.fetchall()
print(f"\nFound {len(rows)} transactions with gaps:\n")

gaps = []
for row in rows:
    uuid, tbl, payment_id, nominal, account_curr, dist_nom, dist_acc = row
    gap_nom = float(nominal or 0) - float(dist_nom or 0)
    gap_acc = float(account_curr or 0) - float(dist_acc or 0)
    
    print(f"UUID: {uuid}")
    print(f"  Table: {tbl}")
    print(f"  Payment ID: {payment_id}")
    print(f"  Nominal: {nominal} → distributed {dist_nom} (gap: {gap_nom})")
    print(f"  Account: {account_curr} → distributed {dist_acc} (gap: {gap_acc})")
    print()
    
    gaps.append({
        'raw_record_uuid': str(uuid),
        'table': tbl,
        'payment_id': payment_id,
        'transaction_nominal': float(nominal or 0),
        'transaction_account_curr': float(account_curr or 0),
        'distributed_nominal': float(dist_nom or 0),
        'distributed_account_curr': float(dist_acc or 0),
        'gap_nominal': gap_nom,
        'gap_account_curr': gap_acc,
    })

if gaps:
    total_gap_acc = sum(abs(g['gap_account_curr']) for g in gaps)
    print(f"Total gap (account currency): {total_gap_acc}")
    
conn.close()
