#!/usr/bin/env python3
"""
Reconcile payment ledger template with current database state
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Parse DATABASE_URL
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=" * 80)
print("PAYMENT DATABASE CURRENT STATE")
print("=" * 80)

# Get all current payments
cur.execute("""
    SELECT 
        p.payment_id,
        p.project_uuid,
        p.counteragent_uuid,
        p.financial_code_uuid,
        p.job_uuid,
        p.income_tax,
        p.currency_uuid,
        proj.project_index,
        ca.name as counteragent,
        fc.validation as financial_code,
        curr.code as currency
    FROM payments p
    LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
    LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
    LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
    LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
    WHERE p.is_active = true
    ORDER BY p.payment_id
""")

payments = cur.fetchall()

print(f"\nTotal active payments in database: {len(payments)}")
print("\nAll payments:")
for row in payments:
    pid, proj_uuid, ca_uuid, fc_uuid, job_uuid, income_tax, curr_uuid, proj_idx, ca_name, fc_val, curr_code = row
    print(f"\nPayment ID: {pid}")
    print(f"  Project: {proj_idx}")
    print(f"  Counteragent: {ca_name}")
    print(f"  Financial Code: {fc_val}")
    print(f"  Currency: {curr_code}")
    print(f"  Income Tax: {income_tax}")

# Check if there are any ledger entries
cur.execute("SELECT COUNT(*) FROM payments_ledger")
ledger_count = cur.fetchone()[0]
print(f"\n" + "=" * 80)
print(f"Total ledger entries in database: {ledger_count}")

if ledger_count > 0:
    cur.execute("""
        SELECT 
            pl.payment_id,
            COUNT(*) as entry_count,
            SUM(pl.accrual) as total_accrual,
            SUM(pl."order") as total_order
        FROM payments_ledger pl
        GROUP BY pl.payment_id
        ORDER BY entry_count DESC
        LIMIT 20
    """)
    
    print("\nTop 20 payment IDs by ledger entry count:")
    for row in cur.fetchall():
        pid, count, accrual, order = row
        print(f"  {pid}: {count} entries (Accrual: {accrual}, Order: {order})")

print("\n" + "=" * 80)
print("RECOMMENDATIONS")
print("=" * 80)
print("""
The template contains 6,969 ledger entries for 4,379 payment IDs that don't exist
in your current database. This suggests:

1. The template is from an OLD system/export
2. Payments need to be imported BEFORE ledger entries
3. Payment IDs need to be reconciled/mapped to your new format

Next steps:
1. Import payments first (from payments import template)
2. Create a mapping between old and new payment IDs
3. Update ledger template with new payment IDs
4. Then import ledger entries

OR

If these are actually correct payment IDs, you need to create the payment records
first before importing ledger data.
""")

conn.close()
