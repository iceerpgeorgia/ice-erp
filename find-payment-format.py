#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url:
    db_url = db_url.split('?schema=')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute('SELECT COUNT(*), COUNT(CASE WHEN is_active THEN 1 END) FROM payments')
total, active = cur.fetchone()
print(f'Total payments: {total}')
print(f'Active payments: {active}')

cur.execute("SELECT id, payment_id, is_active FROM payments WHERE id = 4195 OR payment_id = '0d4941_ba_a7cac6' LIMIT 5")
results = cur.fetchall()
print('\nSearching for payment 4195 or 0d4941_ba_a7cac6:')
if results:
    for r in results:
        print(f'  ID: {r[0]}, payment_id: {r[1]}, active: {r[2]}')
else:
    print('  Not found')

cur.execute('SELECT id, payment_id, is_active FROM payments WHERE payment_id LIKE \'%_%_%\' ORDER BY id LIMIT 10')
print('\nFirst 10 payments with 6_2_6 format:')
for r in cur.fetchall():
    print(f'  ID: {r[0]}, payment_id: {r[1]}, active: {r[2]}')

conn.close()
