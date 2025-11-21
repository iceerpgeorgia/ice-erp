#!/usr/bin/env python3
"""Update country_uuid for the one different record"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Update the record
cur.execute("""
    UPDATE counteragents 
    SET country_uuid = '94279771-0dd8-44b8-955b-275714b1489b' 
    WHERE counteragent_uuid = '9b166bf2-598e-4603-b595-84dfa0e0b49f'
""")

conn.commit()

# Verify
cur.execute("""
    SELECT name, identification_number, country_uuid 
    FROM counteragents 
    WHERE counteragent_uuid = '9b166bf2-598e-4603-b595-84dfa0e0b49f'
""")

row = cur.fetchone()
print(f"✓ Updated: {row[0]}")
print(f"  ID: {row[1]}")
print(f"  Country UUID: {row[2]}")

cur.close()
conn.close()
