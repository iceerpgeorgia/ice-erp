#!/usr/bin/env python3
"""
Verify whether the deleted distributions actually had valid raw_record_uuid values
"""
import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

DB_URL = os.environ['DIRECT_URL']

# These are the raw_record_uuid values from the deleted distributions
DELETED_UUIDS = [
    'caa2cf8c-7009-5a48-8a3c-a1385c5084e4',
    '6ec61407-6c08-5ccd-8847-0b4027ba9ae2',
    '1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a',
    '06f762fc-3ccc-573c-8f93-c18565a717b4',
    '77501426-9a30-5b3f-842a-0270795db7c0'
]

conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=" * 80)
print("VERIFICATION: DID THE DELETED DISTRIBUTIONS HAVE VALID RAW RECORDS?")
print("=" * 80)
print()

# Check each UUID in the TBC GEL table
print("Checking GE65TB7856036050100002_TBC_GEL table:")
print("-" * 80)

for uuid in DELETED_UUIDS:
    cur.execute("""
        SELECT 
            raw_record_uuid::text,
            dockey,
            entriesid,
            payment_id,
            account_currency_amount,
            nominal_amount,
            transaction_date,
            project_uuid::text
        FROM "GE65TB7856036050100002_TBC_GEL"
        WHERE raw_record_uuid::text = %s
    """, (uuid,))
    
    row = cur.fetchone()
    if row:
        print(f"✓ UUID {uuid} EXISTS")
        print(f"  Payment ID: {row['payment_id']}")
        print(f"  Amount: {row['account_currency_amount']} GEL / {row['nominal_amount']} nominal")
        print(f"  DocKey: {row['dockey']}, EntriesId: {row['entriesid']}")
        print(f"  Project UUID: {row['project_uuid']}")
        print()
    else:
        print(f"✗ UUID {uuid} NOT FOUND")
        print()

print()
print("=" * 80)
print("CONCLUSION:")
print("=" * 80)
print()
print("If all UUIDs exist in the raw table, then the distributions we deleted")
print("were NOT orphaned - they were valid distributions pointing to real bank")
print("transactions. The cleanup script searched consolidated_bank_accounts,")
print("but the system is now using raw bank tables as the primary source.")
print()

conn.close()
