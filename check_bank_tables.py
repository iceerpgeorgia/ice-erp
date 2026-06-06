#!/usr/bin/env python3
"""Check what bank-related tables exist."""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("\nBank-related tables:")
print("-" * 80)
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name LIKE '%bank%'
    ORDER BY table_name
""")
for row in cur.fetchall():
    print(f"  {row['table_name']}")

print("\nTables with payment_id column:")
print("-" * 80)
cur.execute("""
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'payment_id'
    ORDER BY table_name
""")
for row in cur.fetchall():
    print(f"  {row['table_name']}")

conn.close()
