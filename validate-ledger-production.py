#!/usr/bin/env python3
"""
Validate ledger template against PRODUCTION Supabase database
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

# Load production environment
load_dotenv('.env.vercel.production')

print("=" * 80)
print("PAYMENT LEDGER TEMPLATE vs SUPABASE PRODUCTION DATABASE")
print("=" * 80)

# Load template
try:
    df = pd.read_excel('templates/paymentledger_import_template.xlsx')
    print(f"\nTemplate loaded: {len(df)} rows")
except Exception as e:
    print(f"\nError loading template: {e}")
    exit(1)

# Connect to Supabase production
try:
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url or 'supabase' not in db_url:
        print("\nERROR: .env.production does not contain Supabase DATABASE_URL")
        print("Please update .env.production with the correct Supabase connection string")
        exit(1)
    
    if '?schema=' in db_url or '?pgbouncer=' in db_url:
        # Keep only the base URL before query parameters
        db_url = db_url.split('?')[0]
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    host = db_url.split('@')[1].split('/')[0] if '@' in db_url else 'unknown'
    print(f"Database connected: {host}")
except Exception as e:
    print(f"Database connection error: {e}")
    exit(1)

# Get payment ID stats
cur.execute("SELECT COUNT(*), COUNT(CASE WHEN is_active THEN 1 END) FROM payments")
total, active = cur.fetchone()
print(f"\nPayments in database:")
print(f"  Total: {total}")
print(f"  Active: {active}")

# Validate payment IDs
unique_payment_ids = df['paymentId'].dropna().unique()
print(f"\nUnique payment IDs in template: {len(unique_payment_ids)}")

# Query existing payment IDs
cur.execute("SELECT payment_id FROM payments")
db_payment_ids = set([row[0] for row in cur.fetchall()])
print(f"Payment IDs in database: {len(db_payment_ids)}")

# Check matches
existing_payment_ids = set(unique_payment_ids) & db_payment_ids
missing_payment_ids = set(unique_payment_ids) - db_payment_ids

print(f"\n  Valid (exist in DB): {len(existing_payment_ids)}")
print(f"  Invalid (NOT in DB): {len(missing_payment_ids)}")

if existing_payment_ids:
    print(f"\nFirst 10 valid payment IDs:")
    for pid in list(existing_payment_ids)[:10]:
        print(f"  - {pid}")

if missing_payment_ids and len(missing_payment_ids) < 20:
    print(f"\nMissing payment IDs:")
    for pid in list(missing_payment_ids):
        print(f"  - {pid}")
elif missing_payment_ids:
    print(f"\nFirst 10 missing payment IDs:")
    for pid in list(missing_payment_ids)[:10]:
        print(f"  - {pid}")

# Check for existing ledger entries
if existing_payment_ids:
    print(f"\nChecking existing ledger entries...")
    placeholders = ','.join(['%s'] * len(existing_payment_ids))
    query = f"""
        SELECT payment_id, COUNT(*) as entry_count
        FROM payments_ledger
        GROUP BY payment_id
        HAVING payment_id IN ({placeholders})
    """
    cur.execute(query, tuple(existing_payment_ids))
    existing_ledger = dict(cur.fetchall())
    
    print(f"  Payment IDs with existing ledger entries: {len(existing_ledger)}")
    
    if existing_ledger:
        print(f"\n  Top 10 payment IDs with existing entries:")
        for pid, count in list(existing_ledger.items())[:10]:
            print(f"    {pid}: {count} entries")

# Check duplicates in template
duplicates = df.groupby(['paymentId', 'effectiveDate']).size()
duplicates = duplicates[duplicates > 1]

print(f"\nDuplicate entries in template: {len(duplicates)}")
if len(duplicates) > 0 and len(duplicates) < 20:
    for (pid, date), count in duplicates.items():
        print(f"  {pid} on {date}: {count} entries")
elif len(duplicates) > 0:
    print(f"  First 10:")
    for (pid, date), count in list(duplicates.items())[:10]:
        print(f"    {pid} on {date}: {count} entries")

# Summary
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)

if len(missing_payment_ids) > 0:
    print(f"CRITICAL: {len(missing_payment_ids)} payment IDs don't exist in database")
    print("  -> These must be created first or removed from template")

if len(existing_payment_ids) > 0:
    print(f"OK: {len(existing_payment_ids)} payment IDs are valid")

if len(duplicates) > 0:
    print(f"WARNING: {len(duplicates)} duplicate entries (same payment + date)")
    print("  -> Review and consolidate before importing")

print("=" * 80)

conn.close()
