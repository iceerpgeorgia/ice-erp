#!/usr/bin/env python3
"""
Compare payments table between Supabase and Local
"""
import psycopg2

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

# Test a specific payment_id that works in Supabase
test_payment_id = "065489_e6_8ab012"

print("=" * 80)
print(f"COMPARING PAYMENT: {test_payment_id}")
print("=" * 80)

# Check Supabase
supabase_conn = psycopg2.connect(SUPABASE_URL)
supabase_cur = supabase_conn.cursor()

query = """
SELECT payment_id, project_uuid, counteragent_uuid, financial_code_uuid 
FROM payments 
WHERE payment_id = %s
"""

supabase_cur.execute(query, (test_payment_id,))
supabase_row = supabase_cur.fetchone()

print(f"\nSupabase:")
if supabase_row:
    print(f"  ✓ Found: {supabase_row[0]}")
    print(f"    Project UUID: {supabase_row[1]}")
    print(f"    Counteragent UUID: {supabase_row[2]}")
else:
    print(f"  ✗ NOT FOUND")

# Check Local
local_conn = psycopg2.connect(LOCAL_URL)
local_cur = local_conn.cursor()

local_cur.execute(query, (test_payment_id,))
local_row = local_cur.fetchone()

print(f"\nLocal:")
if local_row:
    print(f"  ✓ Found: {local_row[0]}")
    print(f"    Project UUID: {local_row[1]}")
    print(f"    Counteragent UUID: {local_row[2]}")
else:
    print(f"  ✗ NOT FOUND")

# Show sample payment_ids from both
print(f"\n{'='*80}")
print("Sample payment_ids in each database:")
print(f"{'='*80}")

supabase_cur.execute("SELECT payment_id FROM payments ORDER BY created_at DESC LIMIT 10")
print("\nSupabase (10 most recent):")
for row in supabase_cur.fetchall():
    print(f"  {row[0]}")

local_cur.execute("SELECT payment_id FROM payments ORDER BY created_at DESC LIMIT 10")
print("\nLocal (10 most recent):")
for row in local_cur.fetchall():
    print(f"  {row[0]}")

supabase_cur.close()
supabase_conn.close()
local_cur.close()
local_conn.close()
