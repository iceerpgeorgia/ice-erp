#!/usr/bin/env python3
"""Show what NOT NULL columns are being checked"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

cur.execute("""
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND is_nullable = 'NO'
      AND column_default IS NULL
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name, ordinal_position
""")

rows = cur.fetchall()
print(f"\nFound {len(rows)} NOT NULL columns (without defaults) being validated:\n")

current_table = None
for table_name, column_name, data_type in rows:
    if table_name != current_table:
        print(f"\n{table_name}:")
        current_table = table_name
    print(f"  - {column_name} ({data_type})")

cur.close()
conn.close()
