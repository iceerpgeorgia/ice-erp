#!/usr/bin/env python3
"""
Search ALL bank account tables for the ID pairs.
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
print(f"SEARCH ALL BANK ACCOUNT TABLES")
print(f"{'='*80}\n")

# Get ALL tables starting with GE
cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name LIKE 'GE%'
    ORDER BY table_name
""")

all_tables = [r['table_name'] for r in cur.fetchall()]
print(f"Found {len(all_tables)} bank account tables to search\n")

found_records = []

for id1, id2 in id_pairs:
    print(f"Searching for DocKey={id1}, EntriesId={id2}")
    print("-" * 60)
    
    found = False
    for table in all_tables:
        try:
            cur.execute(f"""
                SELECT *
                FROM "{table}"
                WHERE dockey = %s AND entriesid = %s
            """, (id1, id2))
            
            raw = cur.fetchone()
            if raw:
                print(f"  ✓✓✓ FOUND in {table}")
                print(f"      Payment ID: {raw.get('payment_id')}")
                print(f"      Debit: {raw.get('debit')}")
                print(f"      Credit: {raw.get('credit')}")
                print(f"      Date: {raw.get('trandate')}")
                print(f"      Raw UUID: {raw.get('raw_record_uuid')}")
                print(f"      Doc Info: {str(raw.get('docinformation'))[:100]}")
                
                found_records.append({
                    'table': table,
                    'id1': id1,
                    'id2': id2,
                    'payment_id': raw.get('payment_id'),
                    'raw_uuid': raw.get('raw_record_uuid'),
                    'debit': raw.get('debit'),
                    'credit': raw.get('credit')
                })
                found = True
                break
        except Exception as e:
            pass
    
    if not found:
        print(f"  ✗ NOT FOUND in any table")
    print()

# Summary
print(f"{'='*80}")
print("SUMMARY:")
print("=" * 80)
print(f"\nFound {len(found_records)}/{len(id_pairs)} transactions\n")

if found_records:
    for rec in found_records:
        print(f"DocKey={rec['id1']}, EntriesId={rec['id2']}")
        print(f"  Table: {rec['table']}")
        print(f"  Payment ID: {rec['payment_id']}")
        print(f"  Amount: Debit={rec['debit']}, Credit={rec['credit']}")
        print()
    
    # Check if they're in consolidated
    print(f"{'='*80}")
    print("CONSOLIDATED STATUS:")
    print("=" * 80 + "\n")
    
    for rec in found_records:
        if rec['raw_uuid']:
            cur.execute("""
                SELECT payment_id, project_uuid, 
                       account_currency_amount, nominal_amount
                FROM consolidated_bank_accounts
                WHERE raw_record_uuid = %s
            """, (rec['raw_uuid'],))
            
            cons = cur.fetchone()
            if cons:
                print(f"DocKey={rec['id1']}: ✓ In consolidated")
                print(f"  Payment ID: {cons['payment_id']}")
                print(f"  Project: {cons['project_uuid']}")
            else:
                print(f"DocKey={rec['id1']}: ✗ NOT in consolidated (needs processing)")
        print()

conn.close()
print(f"{'='*80}\n")
