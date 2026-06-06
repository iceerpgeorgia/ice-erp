#!/usr/bin/env python3
"""
Search local bank account tables for ID1/ID2 pairs.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

id_pairs = [
    ('11620991216', '1707145575'),
    ('12175599131', '1712923332'),
    ('12775547609', '1718865385'),
    ('12810368560', '1719168807'),
    ('13661157049', '1727188775')
]

conn = psycopg2.connect(os.environ['DIRECT_URL'])
conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"SEARCH LOCAL BANK ACCOUNT TABLES")
print(f"{'='*80}\n")

# First check what columns these tables have
print("Checking table structure...")
cur.execute("""
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'GE78BG0000000893486000_BOG_USD'
    ORDER BY ordinal_position
""")

columns = [r['column_name'] for r in cur.fetchall()]
print(f"Columns in GE78BG0000000893486000_BOG_USD: {columns[:20]}")
print()

# Bank account tables
bank_tables = [
    'GE78BG0000000893486000_BOG_USD',
    'GE74BG0000000586388146_BOG_USD',
    'GE43BG0000000609494201_BOG_USD',
    'GE39TB7856036150100001_TBC_USD'
]

found_records = []

for id1, id2 in id_pairs:
    print(f"DocKey: {id1}, EntriesId: {id2}")
    print("-" * 40)
    
    found = False
    for table in bank_tables:
        try:
            cur.execute(f"""
                SELECT *
                FROM "{table}"
                WHERE dockey = %s AND entriesid = %s
            """, (id1, id2))
            
            raw = cur.fetchone()
            if raw:
                print(f"  ✓ Found in {table}")
                print(f"    Payment ID: {raw.get('payment_id')}")
                print(f"    Debit: {raw.get('debit')}")
                print(f"    Credit: {raw.get('credit')}")
                print(f"    Date: {raw.get('trandate')}")
                print(f"    Raw UUID: {raw.get('raw_record_uuid')}")
                
                found_records.append({
                    'table': table,
                    'raw': raw,
                    'id1': id1,
                    'id2': id2
                })
                found = True
                break
        except Exception as e:
            print(f"  Error checking {table}: {e}")
            pass
    
    if not found:
        print(f"  ✗ Not found")
    print()

# Now check consolidated for any found records
if found_records:
    print(f"{'='*80}")
    print("CHECKING CONSOLIDATED TABLE:")
    print("=" * 80 + "\n")
    
    for rec in found_records:
        raw_uuid = rec['raw'].get('raw_record_uuid')
        if raw_uuid:
            cur.execute("""
                SELECT 
                    payment_id,
                    project_uuid,
                    account_currency_amount,
                    nominal_amount,
                    transaction_date
                FROM consolidated_bank_accounts
                WHERE raw_record_uuid = %s
            """, (raw_uuid,))
            
            cons = cur.fetchone()
            if cons:
                print(f"DocKey {rec['id1']}, EntriesId {rec['id2']}:")
                print(f"  ✓ In consolidated_bank_accounts")
                print(f"    Payment ID: {cons['payment_id']}")
                print(f"    Project: {cons['project_uuid']}")
                print(f"    GEL: {cons['account_currency_amount']}")
                print(f"    Nominal: {cons['nominal_amount']}")
                print()
            else:
                print(f"DocKey {rec['id1']}, EntriesId {rec['id2']}:")
                print(f"  ✗ NOT in consolidated_bank_accounts (needs processing)")
                print()

conn.close()
print(f"{'='*80}\n")
