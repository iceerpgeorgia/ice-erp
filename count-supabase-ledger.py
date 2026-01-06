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
print("SUPABASE PRODUCTION - PAYMENTS LEDGER COUNT")
print("=" * 80)

cur.execute('SELECT COUNT(*) FROM payments_ledger')
total = cur.fetchone()[0]
print(f'\nTotal records in payments_ledger: {total}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE accrual IS NOT NULL AND accrual != 0')
accrual_count = cur.fetchone()[0]
print(f'Records with non-zero accrual: {accrual_count}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE "order" IS NOT NULL AND "order" != 0')
order_count = cur.fetchone()[0]
print(f'Records with non-zero order: {order_count}')

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE (accrual IS NOT NULL AND accrual != 0) AND ("order" IS NOT NULL AND "order" != 0)')
both_count = cur.fetchone()[0]
print(f'Records with BOTH non-zero: {both_count}')

cur.execute('SELECT MIN(created_at), MAX(created_at) FROM payments_ledger')
min_date, max_date = cur.fetchone()
print(f'\nRecord creation time range:')
print(f'  Oldest: {min_date}')
print(f'  Newest: {max_date}')

cur.close()
conn.close()

print("\n" + "=" * 80)
