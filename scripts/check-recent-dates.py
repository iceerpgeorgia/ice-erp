#!/usr/bin/env python3
"""Check recent dates in database."""

import os
import psycopg2

db_url = os.getenv("REMOTE_DATABASE_URL") or os.getenv("DATABASE_URL")
if 'pgbouncer=true' in db_url:
    db_url = db_url.replace('?pgbouncer=true&connection_limit=1', '')

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT date, usd_rate, eur_rate 
    FROM nbg_exchange_rates 
    WHERE date >= '2025-11-10' 
    ORDER BY date DESC
""")

dates = cur.fetchall()

print("Recent dates in database:")
print("-" * 50)
for date, usd, eur in dates:
    print(f"{date} - USD: {usd}, EUR: {eur}")

print(f"\nTotal: {len(dates)} records")

cur.execute("SELECT MAX(date) FROM nbg_exchange_rates")
max_date = cur.fetchone()[0]
print(f"Latest date in DB: {max_date}")

conn.close()
