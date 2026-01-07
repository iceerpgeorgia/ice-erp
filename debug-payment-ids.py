#!/usr/bin/env python3
"""
Debug: Check payment_id formats in both tables
"""

import psycopg2

SUPABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

source_conn = psycopg2.connect(SUPABASE_URL)
dest_conn = psycopg2.connect(LOCAL_URL)

print("🔍 Checking payment_id formats...\n")

# Check local payments table
print("📋 Local payments table (first 5):")
cursor = dest_conn.cursor()
cursor.execute('SELECT payment_id FROM payments LIMIT 5')
for row in cursor.fetchall():
    print(f"  {row[0]}")

# Check Supabase payments_ledger table
print("\n📋 Supabase payments_ledger table (first 5):")
cursor = source_conn.cursor()
cursor.execute('SELECT DISTINCT payment_id FROM payments_ledger LIMIT 5')
for row in cursor.fetchall():
    print(f"  {row[0]}")

# Check if we need to copy payments_ledger table structure
print("\n📋 Checking if payments_ledger exists locally...")
cursor = dest_conn.cursor()
try:
    cursor.execute("SELECT COUNT(*) FROM payments_ledger")
    count = cursor.fetchone()[0]
    print(f"  ✅ payments_ledger exists with {count} rows")
except Exception as e:
    print(f"  ❌ Error: {e}")

source_conn.close()
dest_conn.close()
