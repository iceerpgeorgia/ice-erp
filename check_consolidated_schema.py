#!/usr/bin/env python3
"""Check consolidated_bank_accounts schema."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("\nconsolidated_bank_accounts columns:")
print("-" * 80)
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consolidated_bank_accounts'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  {row['column_name']:30} {row['data_type']}")

print("\nRow count:")
cur.execute("SELECT COUNT(*) as cnt FROM consolidated_bank_accounts")
print(f"  {cur.fetchone()['cnt']} rows")

print("\nRows with project_uuid a7380446-a51d-44c2-abf1-0d3a9899d3a2:")
cur.execute("""
    SELECT COUNT(*) as cnt 
    FROM consolidated_bank_accounts 
    WHERE project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'
""")
print(f"  {cur.fetchone()['cnt']} rows")

conn.close()
