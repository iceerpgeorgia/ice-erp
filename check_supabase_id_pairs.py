#!/usr/bin/env python3
"""
Check Supabase raw tables for ID1/ID2 combinations.
"""

import os
import psycopg2
import psycopg2.extras
import urllib.parse
from dotenv import load_dotenv

load_dotenv('.env')

id_pairs = [
    ('11620991216', '1707145575'),
    ('12175599131', '1712923332'),
    ('12775547609', '1718865385'),
    ('12810368560', '1719168807'),
    ('13661157049', '1727188775')
]

# Connect to Supabase
supabase_url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '')
supabase_conn_str = f"postgresql://postgres.{project_ref}:{urllib.parse.quote_plus(os.environ['SUPABASE_SERVICE_ROLE_KEY'])}@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

conn = psycopg2.connect(supabase_conn_str)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"SUPABASE RAW TABLES - SEARCH BY ID1/ID2")
print(f"{'='*80}\n")

# Tables to check
tables = ['bog_gel_raw', 'bog_gel_raw_2024', 'bog_gel_raw_2025', 'bog_gel_raw_2026']

found_records = []

for id1, id2 in id_pairs:
    print(f"ID1: {id1}, ID2: {id2}")
    print("-" * 40)
    
    found = False
    for table in tables:
        try:
            cur.execute(f"""
                SELECT 
                    "DocKey" as doc_key,
                    "EntriesId" as entries_id,
                    "TranDate" as tran_date,
                    "Debit" as debit,
                    "Credit" as credit,
                    "DocInformation" as doc_information,
                    payment_id,
                    raw_record_uuid
                FROM {table}
                WHERE "DocKey" = %s
                AND "EntriesId" = %s
            """, (id1, id2))
            
            raw = cur.fetchone()
            if raw:
                print(f"  ✓ Found in {table}")
                print(f"    Payment ID: {raw['payment_id']}")
                print(f"    Debit: {raw['debit']}")
                print(f"    Credit: {raw['credit']}")
                print(f"    Date: {raw['tran_date']}")
                print(f"    Raw UUID: {raw['raw_record_uuid']}")
                print(f"    Info: {raw['doc_information'][:80] if raw['doc_information'] else 'N/A'}...")
                
                found_records.append(raw)
                found = True
                break
        except Exception as e:
            pass
    
    if not found:
        print(f"  ✗ Not found in any raw table")
    print()

# Summary
if found_records:
    print(f"{'='*80}")
    print("SUMMARY:")
    print("=" * 80)
    
    from collections import defaultdict
    by_payment = defaultdict(list)
    
    for rec in found_records:
        by_payment[rec['payment_id']].append(rec)
    
    print(f"\nFound {len(found_records)} records across {len(by_payment)} payment ID(s):\n")
    
    for payment_id, recs in by_payment.items():
        print(f"{payment_id or 'NULL'}:")
        print(f"  Count: {len(recs)}")
        total_debit = sum(float(r['debit'] or 0) for r in recs)
        total_credit = sum(float(r['credit'] or 0) for r in recs)
        print(f"  Total Debit: {total_debit:,.2f}")
        print(f"  Total Credit: {total_credit:,.2f}")
        print()

conn.close()
print(f"{'='*80}\n")
