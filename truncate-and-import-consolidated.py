#!/usr/bin/env python3
"""
Truncate and reimport consolidated payment ledger data
"""
import pandas as pd
import psycopg2
import os
import uuid
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv('.env.vercel.production')

print("=" * 80)
print("TRUNCATE AND IMPORT CONSOLIDATED PAYMENT LEDGER")
print("=" * 80)

# Load consolidated template - Sheet2
df = pd.read_excel('templates/Consolidated_payments_ledger_import.xlsx', sheet_name='Sheet2')
print(f"\nLoaded Sheet2: {len(df)} rows")

# Drop unnamed columns
df = df[[col for col in df.columns if not col.startswith('Unnamed')]]

# Convert Excel serial dates to actual dates
print("Converting Excel serial dates to dates...")
excel_epoch = datetime(1899, 12, 30)
df['effectiveDate'] = df['effectiveDate'].apply(
    lambda x: (excel_epoch + timedelta(days=int(x))).date() if pd.notna(x) and isinstance(x, (int, float)) else x
)

print(f"Date range: {df['effectiveDate'].min()} to {df['effectiveDate'].max()}")

# Connect to database
db_url = os.getenv('DATABASE_URL')
if '?schema=' in db_url or '?pgbouncer=' in db_url:
    db_url = db_url.split('?')[0]

conn = psycopg2.connect(db_url)
cur = conn.cursor()
print("Database connected")

# Step 0: TRUNCATE TABLE
print("\n" + "=" * 80)
print("STEP 0: TRUNCATING payments_ledger table")
print("=" * 80)

cur.execute("SELECT COUNT(*) FROM payments_ledger")
old_count = cur.fetchone()[0]
print(f"Current records in payments_ledger: {old_count}")

cur.execute("TRUNCATE TABLE payments_ledger RESTART IDENTITY CASCADE")
conn.commit()
print("✓ Table truncated successfully")

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
    print(f"WARNING: {len(invalid_ids)} payment IDs don't exist:")
    for pid in sorted(invalid_ids):
        print(f"  - {pid}")
    
    df = df[df['paymentId'].isin(valid_ids)]
    print(f"\nRemoved {len(df[df['paymentId'].isin(invalid_ids)])} rows with invalid payment IDs")

print(f"✓ {len(df)} rows with valid payment IDs")

# Step 4: Data validation
print("\n" + "=" * 80)
print("STEP 4: Data validation")
print("=" * 80)

# Check for rows with zero or null values in both accrual and order
zero_rows = df[
    ((df['accrual'].isna()) | (df['accrual'] == 0)) &
    ((df['order'].isna()) | (df['order'] == 0))
]

if len(zero_rows) > 0:
    print(f"WARNING: {len(zero_rows)} rows have both accrual and order as 0 or null")
    print("These rows will be skipped during import")
    df = df[~df.index.isin(zero_rows.index)]

print(f"✓ Valid rows ready for import: {len(df)}")

# Step 5: Importing to database
print("\n" + "=" * 80)
print("STEP 5: Importing to database")
print("=" * 80)

import_count = 0
error_count = 0
errors = []
batch_size = 100
batch_count = 0

print(f"Starting import of {len(df)} rows...")

for idx, row in df.iterrows():
    if import_count % 100 == 0:
        print(f"  Processing row {import_count}/{len(df)}... (payment_id: {row['paymentId']})")
    
    try:
        # Handle comment - ensure it's a proper string or None
        comment = row['comment'] if pd.notna(row['comment']) and str(row['comment']).strip() else None
        
        # Generate UUID if invalid
        record_uuid = row['recordUuid']
        try:
            uuid.UUID(str(record_uuid))
        except:
            record_uuid = str(uuid.uuid4())
        
        cur.execute("""
            INSERT INTO payments_ledger 
            (payment_id, effective_date, accrual, "order", comment, record_uuid, user_email)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            row['paymentId'],
            row['effectiveDate'],
            row['accrual'] if pd.notna(row['accrual']) else None,
            row['order'] if pd.notna(row['order']) else None,
            comment,
            record_uuid,
            row['userEmail']
        ))
        import_count += 1
        batch_count += 1
        
        # Commit every 100 records
        if batch_count >= batch_size:
            conn.commit()
            batch_count = 0
            
    except Exception as e:
        error_count += 1
        errors.append({
            'row': idx,
            'payment_id': row['paymentId'],
            'error': str(e)
        })
        
        if error_count >= 50:
            print(f"\n⚠ Too many errors ({error_count}), stopping...")
            break

print(f"\nFinished processing. Committing final batch...")
try:
    conn.commit()
    print("✓ Final batch committed successfully")
    
    print(f"\n✓ Successfully imported {import_count} ledger entries")
    
    if errors:
        print(f"\n⚠ Encountered {error_count} errors:")
        for err in errors[:10]:
            print(f"  Row {err['row']}: {err['payment_id']} - {err['error'][:80]}")
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
print(f"Old record count: {old_count}")
print(f"Template rows: {len(df)}")
print(f"Duplicates resolved: {resolved_count}")
print(f"Rows imported: {import_count}")
print(f"Errors: {error_count}")

if error_count == 0:
    print("\n✓ Import completed successfully!")
else:
    print(f"\n⚠ Import completed with {error_count} errors")
