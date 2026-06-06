#!/usr/bin/env python3
"""Check bank_transaction_batches schema."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("\nbank_transaction_batches columns:")
print("-" * 80)
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bank_transaction_batches'
    ORDER BY ordinal_position
""")
for row in cur.fetchall():
    print(f"  {row['column_name']:30} {row['data_type']}")

conn.close()
