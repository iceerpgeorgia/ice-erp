#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

db_url = os.getenv('DATABASE_URL')
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=" * 80)
print("DETAILED PAYMENTS LEDGER ANALYSIS")
print("=" * 80)

cur.execute('SELECT COUNT(*) FROM payments_ledger')
print(f'\nTotal records: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE accrual IS NOT NULL')
print(f'Records where accrual IS NOT NULL: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE "order" IS NOT NULL')
print(f'Records where order IS NOT NULL: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE accrual = 0')
print(f'Records where accrual = 0: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE "order" = 0')
print(f'Records where order = 0: {cur.fetchone()[0]}')

cur.execute('SELECT payment_id, accrual, "order" FROM payments_ledger WHERE "order" IS NOT NULL ORDER BY created_at DESC LIMIT 5')
print('\nLast 5 records with order (by creation time):')
for row in cur.fetchall():
    print(f'  Payment: {row[0]}, Accrual: {row[1]}, Order: {row[2]}')

cur.close()
conn.close()

print("\n" + "=" * 80)
