#!/usr/bin/env python3
"""Find bank transactions with incomplete distributions (gaps)"""

import os
import psycopg2
import json
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

# Find all income payment IDs for the project
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

cur.execute("""
SELECT payment_id FROM payments 
WHERE record_uuid IN (
  SELECT record_uuid FROM payments 
  WHERE project_uuid = %s::uuid
)
AND EXISTS (
  SELECT 1 FROM financial_codes 
  WHERE uuid = payments.financial_code_uuid 
  AND is_income = true
)
""", (project_uuid,))

income_payment_ids = [row[0] for row in cur.fetchall()]
print(f"Found {len(income_payment_ids)} income payments")
print(f"Payment IDs: {income_payment_ids[:5]}...")

# Check each bank account table for transactions with discrepancies
source_tables = [
    "GE78BG0000000893486000_BOG_GEL",
    "GE74BG0000000586388146_BOG_USD",
    "GE78BG0000000893486000_BOG_USD",
    "GE78BG0000000893486000_BOG_EUR",
    "GE78BG0000000893486000_BOG_AED",
    "GE78BG0000000893486000_BOG_GBP",
    "GE78BG0000000893486000_BOG_KZT",
    "GE78BG0000000893486000_BOG_CNY",
    "GE78BG0000000893486000_BOG_TRY",
    "GE65TB7856036050100002_TBC_GEL",
    "GE39TB7856036150100001_TBC_USD",
    "GE39TB7856036150100001_TBC_EUR",
    "GE79TB7856045067800004_TBC_GEL",
    "GE52TB7856045067800005_TBC_GEL",
]

all_gaps = []

for table in source_tables:
    cur.execute(f"""
    SELECT 
      raw.uuid,
      raw.dockey,
      raw.entriesid,
      raw.payment_id,
      raw.nominal_amount,
      raw.account_currency_amount,
      raw.project_uuid,
      COALESCE(SUM(pj.amount), 0) as distributed_nominal,
      COALESCE(SUM(pj.amount_account_curr), 0) as distributed_account_curr
    FROM "{table}" raw
    LEFT JOIN payments_jobs pj ON pj.raw_record_uuid::text = raw.uuid::text
    WHERE raw.project_uuid = %s::uuid
      AND raw.payment_id = ANY(%s)
      AND NOT EXISTS (
        SELECT 1 FROM bank_transaction_batches 
        WHERE raw_record_uuid = raw.uuid
      )
    GROUP BY raw.uuid, raw.dockey, raw.entriesid, raw.payment_id, raw.nominal_amount, raw.account_currency_amount, raw.project_uuid
    HAVING 
      (COALESCE(raw.nominal_amount, 0) != COALESCE(SUM(pj.amount), 0))
      OR (COALESCE(raw.account_currency_amount, 0) != COALESCE(SUM(pj.amount_account_curr), 0))
    ORDER BY ABS(COALESCE(raw.nominal_amount, 0) - COALESCE(SUM(pj.amount), 0)) DESC
    """, (project_uuid, income_payment_ids))
    
    rows = cur.fetchall()
    if rows:
        print(f"\n{table}: Found {len(rows)} transactions with gaps")
        for row in rows:
            uuid, dockey, entriesid, payment_id, nominal, account_curr, proj_uuid, dist_nominal, dist_account_curr = row
            gap_nominal = float(nominal or 0) - float(dist_nominal or 0)
            gap_account_curr = float(account_curr or 0) - float(dist_account_curr or 0)
            print(f"  {uuid}: {dockey}/{entriesid} payment_id={payment_id}")
            print(f"    Nominal: {nominal} vs distributed {dist_nominal} (gap: {gap_nominal})")
            print(f"    Account: {account_curr} vs distributed {dist_account_curr} (gap: {gap_account_curr})")
            
            all_gaps.append({
                'table': table,
                'raw_record_uuid': str(uuid),
                'dockey': dockey,
                'entriesid': entriesid,
                'payment_id': payment_id,
                'transaction_nominal': float(nominal or 0),
                'transaction_account_curr': float(account_curr or 0),
                'distributed_nominal': float(dist_nominal or 0),
                'distributed_account_curr': float(dist_account_curr or 0),
                'gap_nominal': gap_nominal,
                'gap_account_curr': gap_account_curr,
            })

print(f"\n\nTotal gaps found: {len(all_gaps)}")
if all_gaps:
    total_gap_nominal = sum(gap['gap_nominal'] for gap in all_gaps)
    total_gap_account_curr = sum(gap['gap_account_curr'] for gap in all_gaps)
    print(f"Total gap nominal: {total_gap_nominal}")
    print(f"Total gap account curr: {total_gap_account_curr}")
    
    print("\n\nGaps JSON:")
    print(json.dumps(all_gaps, indent=2))

conn.close()
