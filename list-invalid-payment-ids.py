#!/usr/bin/env python3
"""
Show invalid payment IDs from both import portions
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

print("=" * 80)
print("INVALID PAYMENT IDs - BOTH IMPORT PORTIONS")
print("=" * 80)

# Connect to database
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Load duplicate mappings
cur.execute("SELECT duplicate_payment_id, master_payment_id FROM payment_id_duplicates")
duplicate_map = {dup_id: master_id for dup_id, master_id in cur.fetchall()}

# FIRST PORTION: Original accrual import (from earlier template)
print("\n" + "=" * 80)
print("FIRST PORTION (ACCRUAL) - Original import")
print("=" * 80)

# The first import had 1 missing ID after duplicate resolution
first_missing = ['7e6dfe_b6_912606']

print("\nMissing payment IDs (1):")
for pid in first_missing:
    print(pid)

print("\nCopiable format (comma-separated):")
print(','.join(first_missing))

print("\nCopiable format (one per line):")
print('\n'.join(first_missing))

# SECOND PORTION: Order import (from paymentledger sheet)
print("\n" + "=" * 80)
print("SECOND PORTION (ORDER) - Paymentledger sheet import")
print("=" * 80)

df = pd.read_excel('templates/paymentledger_import_template.xlsx', sheet_name='paymentledger')
df = df[df['order'].notna()].copy()

print(f"Total rows in paymentledger sheet: {len(df)}")

# Resolve duplicates
resolved_count = 0
for idx, row in df.iterrows():
    payment_id = row['paymentId']
    if payment_id in duplicate_map:
        df.at[idx, 'paymentId'] = duplicate_map[payment_id]
        resolved_count += 1

print(f"Resolved {resolved_count} duplicate payment IDs")

# Check which IDs are invalid
unique_payment_ids = df['paymentId'].unique()
format_placeholders = ','.join(['%s'] * len(unique_payment_ids))

cur.execute(f"""
    SELECT payment_id FROM payments WHERE payment_id IN ({format_placeholders})
""", tuple(unique_payment_ids))

valid_ids = set(row[0] for row in cur.fetchall())
invalid_ids = sorted(set(unique_payment_ids) - valid_ids)

print(f"\nMissing payment IDs ({len(invalid_ids)}):")
for pid in invalid_ids:
    print(pid)

print("\nCopiable format (comma-separated):")
print(','.join(invalid_ids))

print("\nCopiable format (one per line):")
print('\n'.join(invalid_ids))

# Count affected rows
affected_rows = df[df['paymentId'].isin(invalid_ids)]
print(f"\nAffected rows: {len(affected_rows)}")

# COMBINED
print("\n" + "=" * 80)
print("COMBINED - All missing payment IDs from both portions")
print("=" * 80)

all_missing = sorted(set(first_missing + invalid_ids))
print(f"\nTotal unique missing payment IDs: {len(all_missing)}")
for pid in all_missing:
    print(pid)

print("\nCopiable format (comma-separated):")
print(','.join(all_missing))

print("\nCopiable format (SQL IN clause):")
print("'" + "','".join(all_missing) + "'")

cur.close()
conn.close()

print("\n" + "=" * 80)
