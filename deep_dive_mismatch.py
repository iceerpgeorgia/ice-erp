#!/usr/bin/env python3
"""Deep dive into the payment ID mismatch."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"DEEP DIVE: Payment ID Mismatch Investigation")
print(f"{'='*80}\n")

# 1. Check if the distribution payment IDs exist in payments table and what project they belong to
print("1. DISTRIBUTION PAYMENT IDs - Check in payments table:")
print("-" * 80)
dist_payment_ids = ['39dbcb_5e_a9dccc', '51a575_51_bcfcf5', 'b993e2_ba_b36a2b']
for pid in dist_payment_ids:
    cur.execute("""
        SELECT payment_id, project_uuid, counteragent_uuid, 
               financial_code_uuid, currency_uuid
        FROM payments
        WHERE payment_id = %s
    """, (pid,))
    row = cur.fetchone()
    if row:
        print(f"  {pid}:")
        print(f"    Project UUID: {row['project_uuid']}")
        print(f"    Same as target? {row['project_uuid'] == project_uuid}")
        print(f"    Counteragent UUID: {row['counteragent_uuid']}")
        print(f"    Financial Code UUID: {row['financial_code_uuid']}")
        print(f"    Currency UUID: {row['currency_uuid']}")
    else:
        print(f"  {pid}: NOT FOUND in payments table")
    print()

# 2. Check the raw_record_uuids referenced in payments_jobs
print("2. RAW_RECORD_UUIDs Referenced in payments_jobs:")
print("-" * 80)
cur.execute("""
    SELECT DISTINCT raw_record_uuid
    FROM payments_jobs
    WHERE project_uuid = %s
    AND raw_record_uuid IS NOT NULL
""", (project_uuid,))
raw_uuids = [row['raw_record_uuid'] for row in cur.fetchall()]
print(f"  Found {len(raw_uuids)} unique raw_record_uuids")

# Check what payment_ids these raw records actually have in consolidated_bank_accounts
print("\n3. What payment_ids do these raw_record_uuids have in bank?")
print("-" * 80)
for uuid in raw_uuids[:5]:  # First 5
    cur.execute("""
        SELECT uuid, payment_id, project_uuid, account_currency_amount, nominal_amount
        FROM consolidated_bank_accounts
        WHERE uuid = %s
    """, (uuid,))
    row = cur.fetchone()
    if row:
        print(f"  UUID: {uuid}")
        print(f"    Bank Payment ID: {row['payment_id']}")
        print(f"    Bank Project UUID: {row['project_uuid']}")
        print(f"    Account Amount: {row['account_currency_amount']}")
        print(f"    Nominal Amount: {row['nominal_amount']}")
    else:
        print(f"  UUID: {uuid} - NOT FOUND in consolidated_bank_accounts")
    print()

# 4. Check if maybe the distributions are pointing to the wrong project?
print("4. PAYMENTS_JOBS rows - which project are the payments actually for?")
print("-" * 80)
cur.execute("""
    SELECT 
        pj.id,
        pj.project_uuid as pj_project_uuid,
        p.project_uuid as payment_project_uuid,
        p.payment_id,
        pj.amount_account_curr,
        pj.amount
    FROM payments_jobs pj
    JOIN payments p ON p.record_uuid = pj.payment_uuid
    WHERE pj.project_uuid = %s
    LIMIT 5
""", (project_uuid,))
rows = cur.fetchall()
for row in rows:
    print(f"  payments_jobs project: {row['pj_project_uuid']}")
    print(f"  payment project:       {row['payment_project_uuid']}")
    print(f"  payment_id:            {row['payment_id']}")
    print(f"  Match? {row['pj_project_uuid'] == row['payment_project_uuid']}")
    print()

conn.close()
print(f"\n{'='*80}\n")
