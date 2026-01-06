#!/usr/bin/env python3
"""
Test the payments-ledger API route query
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

db_url = os.getenv('DATABASE_URL')
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=" * 80)
print("TESTING PAYMENTS LEDGER API QUERY")
print("=" * 80)

# This is the exact query from the API route
query = """
  SELECT 
    pl.id,
    pl.payment_id,
    pl.effective_date,
    pl.accrual,
    pl."order",
    pl.comment,
    pl.record_uuid,
    pl.user_email,
    pl.created_at,
    pl.updated_at,
    p.project_uuid,
    p.counteragent_uuid,
    p.financial_code_uuid,
    p.job_uuid,
    p.income_tax,
    p.currency_uuid,
    proj.project_index,
    proj.project_name,
    ca.name as counteragent_name,
    ca.identification_number as counteragent_id,
    ca.entity_type as counteragent_entity_type,
    fc.validation as financial_code_validation,
    fc.code as financial_code,
    j.job_name,
    curr.code as currency_code
  FROM payments_ledger pl
  LEFT JOIN payments p ON pl.payment_id = p.payment_id
  LEFT JOIN projects proj ON p.project_uuid = proj.project_uuid
  LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
  LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
  LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
  LEFT JOIN currencies curr ON p.currency_uuid = curr.uuid
  ORDER BY pl.effective_date DESC, pl.created_at DESC
  LIMIT 5
"""

try:
    cur.execute(query)
    rows = cur.fetchall()
    
    print(f"\nQuery returned {len(rows)} rows")
    
    if len(rows) > 0:
        print("\nFirst row:")
        print(f"  ID: {rows[0][0]}")
        print(f"  Payment ID: {rows[0][1]}")
        print(f"  Effective Date: {rows[0][2]}")
        print(f"  Accrual: {rows[0][3]}")
        print(f"  Order: {rows[0][4]}")
        print(f"  Project Index: {rows[0][16]}")
        print(f"  Counteragent Name: {rows[0][18]}")
        print(f"  Financial Code: {rows[0][22]}")
        print("\n✓ Query executed successfully!")
    else:
        print("\n⚠ Query returned 0 rows")
        
except Exception as e:
    print(f"\n✗ Query failed: {e}")
    import traceback
    traceback.print_exc()

cur.close()
conn.close()

print("\n" + "=" * 80)
