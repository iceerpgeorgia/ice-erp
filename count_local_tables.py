#!/usr/bin/env python3
import os, psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
conn = psycopg2.connect(os.environ['DIRECT_URL'])
conn.autocommit = True
cur = conn.cursor()

tables = [
    'GE78BG0000000893486000_BOG_USD',
    'GE74BG0000000586388146_BOG_USD',
    'GE43BG0000000609494201_BOG_USD'
]

print("\nRecord counts in local bank account tables:\n")
for table in tables:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        count = cur.fetchone()[0]
        print(f"{table}: {count} records")
    except Exception as e:
        print(f"{table}: ERROR - {e}")

conn.close()
