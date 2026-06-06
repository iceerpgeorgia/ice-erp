#!/usr/bin/env python3
"""
Get consolidated_bank_accounts schema.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'consolidated_bank_accounts'
    ORDER BY ordinal_position
""")

columns = cur.fetchall()

print("\nconsolidated_bank_accounts columns:\n")
for col in columns:
    print(f"  {col['column_name']}: {col['data_type']}")

conn.close()
