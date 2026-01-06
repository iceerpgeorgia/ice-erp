#!/usr/bin/env python3
import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

print("=" * 80)
print("CHECKING IF RECORDS WERE OVERWRITTEN")
print("=" * 80)

# Load both sheets
df_orders = pd.read_excel('templates/paymentledger_import_template.xlsx', sheet_name='paymentledger')
df_orders = df_orders[df_orders['order'].notna()].copy()

print(f"\nOriginal paymentledger sheet (order portion): {len(df_orders)} rows")

# Load duplicate mapping
db_url = os.getenv('DATABASE_URL').split('?')[0] if '?' in os.getenv('DATABASE_URL') else os.getenv('DATABASE_URL')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("SELECT duplicate_payment_id, master_payment_id FROM payment_id_duplicates")
duplicate_map = {dup_id: master_id for dup_id, master_id in cur.fetchall()}

# Resolve duplicates in order data
for idx, row in df_orders.iterrows():
    payment_id = row['paymentId']
    if payment_id in duplicate_map:
        df_orders.at[idx, 'paymentId'] = duplicate_map[payment_id]

# Filter to valid payment IDs
unique_payment_ids = df_orders['paymentId'].unique()
cur.execute(f"""
    SELECT payment_id FROM payments WHERE payment_id IN ({','.join(['%s'] * len(unique_payment_ids))})
""", tuple(unique_payment_ids))
valid_ids = set(row[0] for row in cur.fetchall())
df_orders = df_orders[df_orders['paymentId'].isin(valid_ids)]

print(f"After resolving duplicates and filtering invalid IDs: {len(df_orders)} rows")

# Check database
cur.execute('SELECT COUNT(*) FROM payments_ledger')
total_in_db = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE "order" != 0')
order_records = cur.fetchone()[0]

cur.execute('SELECT COUNT(*) FROM payments_ledger WHERE accrual != 0')
accrual_records = cur.fetchone()[0]

print(f"\nDatabase counts:")
print(f"  Total records: {total_in_db}")
print(f"  Records with non-zero accrual: {accrual_records}")
print(f"  Records with non-zero order: {order_records}")

print(f"\nExpected:")
print(f"  Should have imported ~7,284 order records")
print(f"  Actually imported: {order_records} order records")
print(f"  Missing: {7284 - order_records} order records")

# Check for overlapping record UUIDs
cur.execute("""
    SELECT record_uuid, COUNT(*) 
    FROM payments_ledger 
    GROUP BY record_uuid 
    HAVING COUNT(*) > 1
""")
duplicates = cur.fetchall()
if duplicates:
    print(f"\n⚠ Found {len(duplicates)} duplicate record UUIDs in database:")
    for dup in duplicates[:5]:
        print(f"  UUID {dup[0]}: {dup[1]} occurrences")
else:
    print("\n✓ No duplicate record UUIDs in database")

cur.close()
conn.close()

print("\n" + "=" * 80)
