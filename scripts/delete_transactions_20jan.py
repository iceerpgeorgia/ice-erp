import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Both tables are in the same Supabase database
db_url = os.getenv('DATABASE_URL')
# Clean the URL - remove all query parameters for psycopg2
if '?' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cursor = conn.cursor()

target_date = '2026-01-20'
raw_table = 'bog_gel_raw_893486000'  # BOG GEL raw table with account UUID

print(f'\n=== Checking records for {target_date} ===\n')

# Check bog_gel_raw using docactualdate (the transaction date column in raw table)
cursor.execute(f"""
    SELECT COUNT(*) FROM public.{raw_table} 
    WHERE docactualdate = %s
""", (target_date,))
raw_count = cursor.fetchone()[0]
print(f'{raw_table}: {raw_count} records found')

# Check consolidated_bank_accounts (with schema)
cursor.execute("""
    SELECT COUNT(*) FROM public.consolidated_bank_accounts 
    WHERE transaction_date = %s
""", (target_date,))
consolidated_count = cursor.fetchone()[0]
print(f'consolidated_bank_accounts: {consolidated_count} records found')

print(f'\n=== Deleting records ===\n')

# Delete from bog_gel_raw using docactualdate
cursor.execute(f"""
    DELETE FROM public.{raw_table} 
    WHERE docactualdate = %s
""", (target_date,))
deleted_raw = cursor.rowcount
print(f'✓ Deleted {deleted_raw} records from {raw_table}')

# Delete from consolidated_bank_accounts
cursor.execute("""
    DELETE FROM public.consolidated_bank_accounts 
    WHERE transaction_date = %s
""", (target_date,))
deleted_consolidated = cursor.rowcount
print(f'✓ Deleted {deleted_consolidated} records from consolidated_bank_accounts')

# Commit all changes
conn.commit()

# Close connection
cursor.close()
conn.close()

print(f'\n=== Deletion complete ===')

