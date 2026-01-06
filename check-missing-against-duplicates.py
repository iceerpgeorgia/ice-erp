#!/usr/bin/env python3
"""
Check missing payment IDs against duplicate_payment_ids table
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

print("=" * 80)
print("CHECKING MISSING PAYMENT IDs AGAINST DUPLICATE_PAYMENT_IDS TABLE")
print("=" * 80)

# Load template
df = pd.read_excel('templates/paymentledger_import_template.xlsx')
print(f"\nTemplate loaded: {len(df)} rows")

# Connect to Supabase
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()
print("Database connected")

# Get all payment IDs from template
unique_payment_ids = df['paymentId'].dropna().unique()

# Get active payment IDs from payments table
cur.execute("SELECT payment_id FROM payments WHERE is_active = true")
db_payment_ids = set([row[0] for row in cur.fetchall()])

# Find missing IDs
missing_payment_ids = set(unique_payment_ids) - db_payment_ids

print(f"\nPayment IDs missing from payments table: {len(missing_payment_ids)}")

# Check if payment_id_duplicates table exists
cur.execute("""
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_id_duplicates'
    )
""")

if not cur.fetchone()[0]:
    print("\nERROR: payment_id_duplicates table does not exist!")
    conn.close()
    exit(1)

print("\n✓ payment_id_duplicates table found")

# Check structure of payment_id_duplicates table
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'payment_id_duplicates'
    ORDER BY ordinal_position
""")

print("\nTable structure:")
for col, dtype in cur.fetchall():
    print(f"  {col}: {dtype}")

# Get all records from payment_id_duplicates
cur.execute("SELECT * FROM payment_id_duplicates")
duplicate_records = cur.fetchall()
print(f"\nTotal records in payment_id_duplicates: {len(duplicate_records)}")

if len(duplicate_records) > 0:
    # Show sample
    print("\nSample records (first 5):")
    for record in duplicate_records[:5]:
        print(f"  {record}")

# Check how many missing IDs are actually duplicates
if len(missing_payment_ids) > 0:
    placeholders = ','.join(['%s'] * len(missing_payment_ids))
    
    # Try different column name possibilities
    possible_columns = [
        'duplicate_payment_id',
        'old_payment_id', 
        'payment_id',
        'duplicate_id'
    ]
    
    found_column = None
    for col in possible_columns:
        try:
            query = f"SELECT {col} FROM payment_id_duplicates WHERE {col} IN ({placeholders})"
            cur.execute(query, tuple(missing_payment_ids))
            results = cur.fetchall()
            if results:
                found_column = col
                break
        except:
            continue
    
    if found_column:
        query = f"""
            SELECT {found_column}, master_payment_id 
            FROM payment_id_duplicates 
            WHERE {found_column} IN ({placeholders})
        """
        cur.execute(query, tuple(missing_payment_ids))
        duplicate_mappings = cur.fetchall()
        
        print(f"\n✓ Found {len(duplicate_mappings)} missing IDs in payment_id_duplicates table")
        
        if len(duplicate_mappings) > 0:
            print(f"\nThese IDs are duplicates that were consolidated:")
            for old_id, new_id in duplicate_mappings[:20]:
                print(f"  {old_id} → {new_id}")
            
            if len(duplicate_mappings) > 20:
                print(f"  ... and {len(duplicate_mappings) - 20} more")
        
        # Check if the consolidated IDs exist
        consolidated_ids = [row[1] for row in duplicate_mappings]
        valid_consolidated = set(consolidated_ids) & db_payment_ids
        
        print(f"\nMaster payment IDs that exist: {len(valid_consolidated)}/{len(consolidated_ids)}")
        
        # IDs that are truly missing (not duplicates, not in payments)
        duplicate_old_ids = set([row[0] for row in duplicate_mappings])
        truly_missing = missing_payment_ids - duplicate_old_ids
        
        print(f"\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Total missing from payments table: {len(missing_payment_ids)}")
        print(f"  - Found in duplicate_payment_ids: {len(duplicate_mappings)}")
        print(f"  - Truly missing (need investigation): {len(truly_missing)}")
        
        if truly_missing:
            print(f"\nTruly missing payment IDs (first 20):")
            for pid in list(truly_missing)[:20]:
                print(f"  - {pid}")
    else:
        print("\nCould not find the correct column name for duplicate payment IDs")
        print("Available columns:", [col[0] for col in cur.description])

conn.close()
