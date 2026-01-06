#!/usr/bin/env python3
"""
Import payment ledger data with automatic duplicate payment ID consolidation
"""
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv('.env.vercel.production')

print("=" * 80)
print("PAYMENT LEDGER IMPORT WITH AUTOMATIC DUPLICATE CONSOLIDATION")
print("=" * 80)

# Load template
df = pd.read_excel('templates/paymentledger_import_template.xlsx')
print(f"\nLoaded template: {len(df)} rows")

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

# Step 3: Validate all payment IDs exist
print("\n" + "=" * 80)
print("STEP 3: Validating payment IDs")
print("=" * 80)

unique_payment_ids = df['paymentId'].dropna().unique()
cur.execute("SELECT payment_id FROM payments WHERE is_active = true")
db_payment_ids = set([row[0] for row in cur.fetchall()])

missing = set(unique_payment_ids) - db_payment_ids
if missing:
    print(f"WARNING: {len(missing)} payment IDs don't exist after resolution:")
    for pid in list(missing)[:10]:
        print(f"  - {pid}")
    
    # Remove rows with missing payment IDs
    rows_before = len(df)
    df = df[df['paymentId'].isin(db_payment_ids)]
    rows_after = len(df)
    print(f"\nRemoved {rows_before - rows_after} rows with invalid payment IDs")
    
    if rows_after == 0:
        print("\nERROR: No valid rows remaining. Cannot proceed with import.")
        conn.close()
        exit(1)

print(f"✓ {len(df)} rows with valid payment IDs")

# Step 4: Handle duplicate entries (same payment_id + effectiveDate)
print("\n" + "=" * 80)
print("STEP 4: Handling duplicate entries")
print("=" * 80)

print("Converting comment column to string...")
df['comment'] = df['comment'].astype(str).replace('nan', '')

print("Grouping and aggregating data...")
df_grouped = df.groupby(['paymentId', 'effectiveDate']).agg({
    'accrual': 'sum',
    'order': 'sum',
    'comment': lambda x: ' | '.join([str(c) for c in x if c and str(c) != 'nan' and str(c).strip()]) if len([c for c in x if c and str(c) != 'nan' and str(c).strip()]) > 0 else None,
    'recordUuid': 'first',
    'userEmail': 'first'
}).reset_index()

print(f"Original rows: {len(df)}")
print(f"After consolidating duplicates: {len(df_grouped)}")
print(f"Consolidated {len(df) - len(df_grouped)} duplicate entries")

# Step 5: Validate data
print("\n" + "=" * 80)
print("STEP 5: Data validation")
print("=" * 80)

# Check required fields
missing_payment_id = df_grouped['paymentId'].isna().sum()
missing_date = df_grouped['effectiveDate'].isna().sum()
missing_email = df_grouped['userEmail'].isna().sum()

if missing_payment_id > 0 or missing_date > 0 or missing_email > 0:
    print(f"ERROR: Missing required fields:")
    print(f"  paymentId: {missing_payment_id} nulls")
    print(f"  effectiveDate: {missing_date} nulls")
    print(f"  userEmail: {missing_email} nulls")
    conn.close()
    exit(1)

# Check business rule: at least one of accrual or order must be non-zero
invalid_rows = df_grouped[
    ((df_grouped['accrual'].isna()) | (df_grouped['accrual'] == 0)) &
    ((df_grouped['order'].isna()) | (df_grouped['order'] == 0))
]

if len(invalid_rows) > 0:
    print(f"WARNING: {len(invalid_rows)} rows have both accrual and order as 0 or null")
    print("These rows will be skipped during import")
    df_grouped = df_grouped[
        ~(((df_grouped['accrual'].isna()) | (df_grouped['accrual'] == 0)) &
          ((df_grouped['order'].isna()) | (df_grouped['order'] == 0)))
    ]

print(f"✓ Valid rows ready for import: {len(df_grouped)}")

# Step 6: Import to database
print("\n" + "=" * 80)
print("STEP 6: Importing to database")
print("=" * 80)

import_count = 0
error_count = 0
errors = []

print(f"Starting import of {len(df_grouped)} rows...")

for idx, row in df_grouped.iterrows():
    try:
        if import_count % 100 == 0:
            print(f"  Processing row {import_count}/{len(df_grouped)}... (payment_id: {row['paymentId']})")
        
        cur.execute("""
            INSERT INTO payments_ledger (
                payment_id,
                effective_date,
                accrual,
                "order",
                comment,
                user_email
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            row['paymentId'],
            row['effectiveDate'],
            row['accrual'] if pd.notna(row['accrual']) else None,
            row['order'] if pd.notna(row['order']) else None,
            row['comment'] if pd.notna(row['comment']) and str(row['comment']).strip() else None,
            row['userEmail']
        ))
        import_count += 1
            
    except Exception as e:
        error_count += 1
        errors.append({
            'row': idx + 2,  # Excel row number
            'payment_id': row['paymentId'],
            'error': str(e)
        })
        if error_count <= 10:
            print(f"  ERROR on row {idx + 2}: {e}")
        if error_count > 50:
            print(f"  Too many errors ({error_count}), stopping...")
            break

print(f"\nFinished processing. Committing transaction...")

# Commit or rollback
if error_count == 0:
    conn.commit()
    print(f"\n✓ Successfully imported {import_count} ledger entries")
else:
    conn.rollback()
    print(f"\n✗ Import failed with {error_count} errors. Transaction rolled back.")
    print("\nFirst 10 errors:")
    for err in errors[:10]:
        print(f"  Row {err['row']} ({err['payment_id']}): {err['error']}")

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
    print(f"\n✗ Import failed. Please review errors above.")

conn.close()
