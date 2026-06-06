#!/usr/bin/env python3
import os, psycopg2
from dotenv import load_dotenv
load_dotenv('.env')
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

# Check tables with id1 column
cur.execute("""
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name IN ('id1', 'id2')
    ORDER BY table_name, column_name
""")

print("\nTables with id1/id2 columns:\n")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Also check for columns with similar names
cur.execute("""
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name LIKE 'GE%'
    ORDER BY table_name
""")

print("\n\nAll tables starting with GE:\n")
for row in cur.fetchall():
    print(f"  {row[0]}")

conn.close()
