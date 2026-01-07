#!/usr/bin/env python3
"""
Test how Supabase handles payments_ledger JOINs
"""
import psycopg2

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

conn = psycopg2.connect(SUPABASE_URL)
cur = conn.cursor()

print("=" * 80)
print("SUPABASE PAYMENTS LEDGER JOIN TEST")
print("=" * 80)

# Test recent ledger entries
query = """
SELECT 
    pl.payment_id,
    pl.effective_date,
    p.project_uuid,
    p.counteragent_uuid,
    p.financial_code_uuid,
    proj.project_name,
    ca.name as counteragent_name
FROM payments_ledger pl
LEFT JOIN payments p ON pl.payment_id = p.payment_id
LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
ORDER BY pl.effective_date DESC
LIMIT 20
"""

cur.execute(query)
rows = cur.fetchall()

print(f"\nMost recent 20 ledger entries in Supabase:\n")
matched = 0
for row in rows:
    payment_id = row[0]
    has_match = row[2] is not None
    if has_match:
        matched += 1
        print(f"✓ {payment_id} - Project: {row[5]}, Counteragent: {row[6]}")
    else:
        print(f"✗ {payment_id} - NO MATCHING PAYMENT")

print(f"\n{'='*80}")
print(f"Summary: {matched}/{len(rows)} ledger entries have matching payments")
print(f"{'='*80}")

cur.close()
conn.close()
