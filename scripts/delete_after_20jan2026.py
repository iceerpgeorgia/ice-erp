import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError('DATABASE_URL not set')

# Clean the URL for psycopg2
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

target_date = '2026-01-20'
raw_table = 'bog_gel_raw_893486000'

print(f"\n=== Checking records after {target_date} ===\n")

# Raw table counts (docactualdate used in prior script)
cursor.execute(f"""
    SELECT COUNT(*) FROM public.{raw_table}
    WHERE docactualdate > %s
""", (target_date,))
raw_count = cursor.fetchone()[0]
print(f"{raw_table}: {raw_count} records found")

# Consolidated counts
cursor.execute("""
    SELECT COUNT(*) FROM public.consolidated_bank_accounts
    WHERE transaction_date > %s
""", (target_date,))
consolidated_count = cursor.fetchone()[0]
print(f"consolidated_bank_accounts: {consolidated_count} records found")

print(f"\n=== Deleting records ===\n")

cursor.execute(f"""
    DELETE FROM public.{raw_table}
    WHERE docactualdate > %s
""", (target_date,))
deleted_raw = cursor.rowcount
print(f"✓ Deleted {deleted_raw} records from {raw_table}")

cursor.execute("""
    DELETE FROM public.consolidated_bank_accounts
    WHERE transaction_date > %s
""", (target_date,))
deleted_consolidated = cursor.rowcount
print(f"✓ Deleted {deleted_consolidated} records from consolidated_bank_accounts")

conn.commit()
cursor.close()
conn.close()

print(f"\n=== Deletion complete ===")
