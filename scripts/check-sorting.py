#!/usr/bin/env python3
"""Check sorting of financial codes under parent 0"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Get codes under parent "0"
cur.execute("""
    SELECT code, name, sort_order 
    FROM financial_codes 
    WHERE parent_uuid = (SELECT uuid FROM financial_codes WHERE code = '0')
    ORDER BY sort_order
""")

rows = cur.fetchall()
print("\nCodes under parent '0' (sorted by sort_order):")
print("=" * 80)
for code, name, sort_order in rows:
    print(f"{sort_order:3d}. {code:10s} - {name}")

# Also check a few other parent codes for verification
print("\n\nCodes under parent '1' (sorted by sort_order):")
print("=" * 80)
cur.execute("""
    SELECT code, name, sort_order 
    FROM financial_codes 
    WHERE parent_uuid = (SELECT uuid FROM financial_codes WHERE code = '1')
    ORDER BY sort_order
    LIMIT 15
""")
rows = cur.fetchall()
for code, name, sort_order in rows:
    print(f"{sort_order:3d}. {code:10s} - {name[:50]}")

cur.close()
conn.close()
