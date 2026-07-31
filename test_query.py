#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DIRECT_URL'))
cur = conn.cursor()

# Test the aggregation query
query = """
SELECT
  payment_id,
  SUM(nominal_amount) as total_payment
FROM (
  SELECT
    cba.payment_id,
    cba.nominal_amount,
    cba.raw_record_uuid,
    cba.account_currency_amount
  FROM (
    SELECT payment_id, nominal_amount, raw_record_uuid, account_currency_amount FROM "GE78BG0000000893486000_BOG_GEL"
    UNION ALL
    SELECT payment_id, nominal_amount, raw_record_uuid, account_currency_amount FROM "GE65TB7856036050100002_TBC_GEL"
  ) cba
  WHERE NOT EXISTS (
    SELECT 1 FROM bank_transaction_batches btb
    WHERE btb.raw_record_uuid::text = cba.raw_record_uuid::text
  )

  UNION ALL

  SELECT
    pa.payment_id,
    COALESCE(pa.nominal_amount, pa.amount) as nominal_amount,
    NULL::uuid as raw_record_uuid,
    NULL::numeric as account_currency_amount
  FROM payment_adjustments pa
  WHERE (pa.is_deleted = false OR pa.is_deleted IS NULL)
) combined
WHERE payment_id IS NOT NULL
GROUP BY payment_id;
"""

print("Running aggregation query...")
cur.execute(query)
rows = cur.fetchall()
print(f"\nTotal payment records found: {len(rows)}")

# Find the specific payment
payment_id = 'c6c9f1_12_23808b'
print(f"\nSearching for payment_id={payment_id}")
for row in rows:
    if row[0] == payment_id:
        print(f"  Found! Total: {row[1]}")
        break
else:
    print(f"  NOT FOUND in results!")

# Also directly query adjustments for this payment
print(f"\nDirect query for adjustments with payment_id={payment_id}:")
cur.execute("SELECT id, amount, nominal_amount FROM payment_adjustments WHERE payment_id = %s AND is_deleted = false", (payment_id,))
adjs = cur.fetchall()
print(f"  Found: {len(adjs)}")
for adj in adjs:
    print(f"    id={adj[0]}, amount={adj[1]}, nominal_amount={adj[2]}")

cur.close()
conn.close()
