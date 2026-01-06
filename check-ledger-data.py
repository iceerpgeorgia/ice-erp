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
print("PAYMENTS LEDGER DATABASE CHECK")
print("=" * 80)

cur.execute('SELECT COUNT(*) FROM payments_ledger')
print(f'\nTotal records in payments_ledger: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE accrual IS NOT NULL')
print(f'Records with accrual: {cur.fetchone()[0]}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE "order" IS NOT NULL')
print(f'Records with order: {cur.fetchone()[0]}')

cur.execute('SELECT payment_id, effective_date, accrual, "order" FROM payments_ledger ORDER BY created_at DESC LIMIT 5')
print('\nLast 5 records (by creation time):')
for row in cur.fetchall():
    print(f'  Payment: {row[0]}, Date: {row[1]}, Accrual: {row[2]}, Order: {row[3]}')

cur.close()
conn.close()

print("\n" + "=" * 80)
