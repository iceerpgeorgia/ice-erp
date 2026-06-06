#!/usr/bin/env python3
import os, psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

cur.execute("""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'GE65TB7856036050100002_TBC_GEL'
    ORDER BY ordinal_position
""")

print("\nGE65TB7856036050100002_TBC_GEL columns:\n")
for row in cur.fetchall():
    print(f"  {row[0]}")

conn.close()
