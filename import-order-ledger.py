#!/usr/bin/env python3
"""
Import payment ledger ORDER data with automatic duplicate payment ID consolidation
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.vercel.production')

print("=" * 80)
print("PAYMENT LEDGER ORDER IMPORT WITH AUTOMATIC DUPLICATE CONSOLIDATION")
print("=" * 80)

# Load template - paymentledger sheet
df = pd.read_excel('templates/paymentledger_import_template.xlsx', sheet_name='paymentledger')
print(f"\nLoaded paymentledger sheet: {len(df)} rows")

# Filter to only order entries (where order is not null)
df = df[df['order'].notna()].copy()
print(f"Filtered to order entries: {len(df)} rows")

# Connect to database
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()
print("Database connected")

# Step 1: Build duplicate payment ID mapping
print("\n" + "=" * 80)
print("STEP 1: Building duplicate payment ID mapping")
print("=" * 80)

cur.execute("""
    SELECT duplicate_payment_id, master_payment_id
    FROM payment_id_duplicates
""")

duplicate_map = {}
for dup_id, master_id in cur.fetchall():
    duplicate_map[dup_id] = master_id

print(f"Loaded {len(duplicate_map)} duplicate → master mappings")

# Step 2: Resolve payment IDs
print("\n" + "=" * 80)
print("STEP 2: Resolving payment IDs")
print("=" * 80)

print("Checking for duplicate payment IDs in template...")
resolved_count = 0
for idx, row in df.iterrows():
    if idx % 1000 == 0:
        print(f"  Processed {idx}/{len(df)} rows...")
    
    payment_id = row['paymentId']
    if payment_id in duplicate_map:
        df.at[idx, 'paymentId'] = duplicate_map[payment_id]
        resolved_count += 1

print(f"Resolved {resolved_count} duplicate payment IDs to master IDs")

# Step 3: Validate payment IDs
print("\n" + "=" * 80)
print("STEP 3: Validating payment IDs")
print("=" * 80)

unique_payment_ids = df['paymentId'].unique()
format_placeholders = ','.join(['%s'] * len(unique_payment_ids))

cur.execute(f"""
    SELECT payment_id FROM payments WHERE payment_id IN ({format_placeholders})
""", tuple(unique_payment_ids))

valid_ids = set(row[0] for row in cur.fetchall())
invalid_ids = set(unique_payment_ids) - valid_ids

if invalid_ids:
    print(f"WARNING: {len(invalid_ids)} payment IDs don't exist after resolution:")
    for pid in sorted(invalid_ids):
        print(f"  - {pid}")
    
    df = df[df['paymentId'].isin(valid_ids)]
    print(f"\nRemoved {len(df[df['paymentId'].isin(invalid_ids)])} rows with invalid payment IDs")

print(f"✓ {len(df)} rows with valid payment IDs")

# Step 4: Handling duplicate entries (same payment_id + date)
print("\n" + "=" * 80)
print("STEP 4: Handling duplicate entries")
print("=" * 80)

print("Converting comment column to string...")
df['comment'] = df['comment'].fillna('').astype(str).replace('nan', '')

print("Grouping and aggregating data...")
# Convert numeric columns to proper types
df['accrual'] = pd.to_numeric(df['accrual'], errors='coerce')
df['order'] = pd.to_numeric(df['order'], errors='coerce')

df_grouped = df.groupby(['paymentId', 'effectiveDate'], as_index=False).agg({
    'accrual': 'sum',
    'order': 'sum',
    'comment': lambda x: ' | '.join([c for c in x if c and c.strip()]) or None,
    'recordUuid': 'first',
    'userEmail': 'first'
})

print(f"Original rows: {len(df)}")
print(f"After consolidating duplicates: {len(df_grouped)}")
print(f"Consolidated {len(df) - len(df_grouped)} duplicate entries")

# Step 5: Data validation
print("\n" + "=" * 80)
print("STEP 5: Data validation")
print("=" * 80)

# Check for rows with zero or null values in both accrual and order
zero_rows = df_grouped[
    ((df_grouped['accrual'].isna()) | (df_grouped['accrual'] == 0)) &
    ((df_grouped['order'].isna()) | (df_grouped['order'] == 0))
]

if len(zero_rows) > 0:
    print(f"WARNING: {len(zero_rows)} rows have both accrual and order as 0 or null")
    print("These rows will be skipped during import")
    df_grouped = df_grouped[~df_grouped.index.isin(zero_rows.index)]

print(f"✓ Valid rows ready for import: {len(df_grouped)}")

# Step 6: Importing to database
print("\n" + "=" * 80)
print("STEP 6: Importing to database")
print("=" * 80)

# Check which record UUIDs already exist
print("Checking for existing record UUIDs...")
unique_uuids = df_grouped['recordUuid'].unique()
format_placeholders = ','.join(['%s'] * len(unique_uuids))

cur.execute(f"""
    SELECT record_uuid FROM payments_ledger WHERE record_uuid IN ({format_placeholders})
""", tuple(unique_uuids))

existing_uuids = set(row[0] for row in cur.fetchall())
print(f"Found {len(existing_uuids)} records already in database")

# Filter out existing records
df_grouped = df_grouped[~df_grouped['recordUuid'].isin(existing_uuids)]
print(f"Will import {len(df_grouped)} new records")

import_count = 0
error_count = 0
errors = []

print(f"\nStarting import of {len(df_grouped)} rows...")

batch_size = 100
batch_count = 0

for idx, row in df_grouped.iterrows():
    if import_count % 100 == 0:
        print(f"  Processing row {import_count}/{len(df_grouped)}... (payment_id: {row['paymentId']})")
    
    try:
        # Round down effective_date to date only
        effective_date = pd.to_datetime(row['effectiveDate']).date()
        
        # Handle comment - ensure it's a proper string or None
        comment = row['comment'] if pd.notna(row['comment']) and str(row['comment']).strip() else None
        
        cur.execute("""
            INSERT INTO payments_ledger 
            (payment_id, effective_date, accrual, "order", comment, record_uuid, user_email)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            row['paymentId'],
            effective_date,
            row['accrual'] if pd.notna(row['accrual']) else None,
            row['order'] if pd.notna(row['order']) else None,
            comment,
            row['recordUuid'],
            row['userEmail']
        ))
        import_count += 1
        batch_count += 1
        
        # Commit every 100 records
        if batch_count >= batch_size:
            conn.commit()
            batch_count = 0
            
    except Exception as e:
        # Skip this record and continue
        error_count += 1
        errors.append({
            'row': idx,
            'payment_id': row['paymentId'],
            'record_uuid': row['recordUuid'],
            'error': str(e)
        })
        
        if error_count >= 100:
            print(f"\n⚠ Too many errors ({error_count}), stopping...")
            break

print(f"\nFinished processing. Committing final batch...")
try:
    conn.commit()
    print("✓ Final batch committed successfully")
    print("✓ Transaction committed successfully")
    
    print(f"\n✓ Successfully imported {import_count} ledger entries")
    
    if errors:
        print(f"\n⚠ Encountered {error_count} errors:")
        for err in errors[:10]:  # Show first 10 errors
            print(f"  Row {err['row']}: {err['payment_id']} (UUID: {err['record_uuid'][:8]}...) - {err['error'][:80]}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more errors")

except Exception as e:
    print(f"\n✗ Commit failed: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()

# Summary
print("\n" + "=" * 80)
print("IMPORT SUMMARY")
print("=" * 80)
print(f"Template rows: {len(df)}")
print(f"Duplicates resolved: {resolved_count}")
print(f"Duplicate entries consolidated: {len(df) - len(df_grouped)}")
print(f"Rows imported: {import_count}")
print(f"Errors: {error_count}")

if error_count == 0:
    print("\n✓ Import completed successfully!")
else:
    print(f"\n⚠ Import completed with {error_count} errors")
