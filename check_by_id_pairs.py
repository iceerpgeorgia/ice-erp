#!/usr/bin/env python3
"""
Check bank transactions by ID1, ID2 combinations.
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
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"BANK TRANSACTIONS BY ID1/ID2")
print(f"{'='*80}\n")

# Get all account tables with id1/id2
cur.execute("""
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE column_name = 'id1'
    AND table_schema = 'public'
    AND table_name LIKE 'GE%'
    ORDER BY table_name
""")

account_tables = [row['table_name'] for row in cur.fetchall()]
print(f"Found {len(account_tables)} account tables\n")

found_txns = []

for id1, id2 in id_pairs:
    print(f"ID1: {id1}, ID2: {id2}")
    print("-" * 40)
    
    found = False
    for table in account_tables:
        try:
            cur.execute(f"""
                SELECT 
                    id1, id2, date, amount, nominal_amount, 
                    payment_id, raw_record_uuid, description
                FROM "{table}"
                WHERE id1 = %s AND id2 = %s
            """, (id1, id2))
            
            raw = cur.fetchone()
            if raw:
                print(f"  ✓ Found in {table}")
                print(f"    Payment ID: {raw['payment_id']}")
                print(f"    Amount: {raw['amount']}")
                print(f"    Nominal: {raw['nominal_amount']}")
                print(f"    Date: {raw['date']}")
                print(f"    Raw UUID: {raw['raw_record_uuid']}")
                
                # Check consolidated
                if raw['raw_record_uuid']:
                    cur.execute("""
                        SELECT payment_id, project_uuid, 
                               account_currency_amount, nominal_amount
                        FROM consolidated_bank_accounts
                        WHERE raw_record_uuid = %s
                    """, (raw['raw_record_uuid'],))
                    
                    cons = cur.fetchone()
                    if cons:
                        print(f"    Consolidated:")
                        print(f"      Payment ID: {cons['payment_id']}")
                        print(f"      Project: {cons['project_uuid']}")
                        
                        found_txns.append({
                            'id1': id1,
                            'id2': id2,
                            'payment_id': cons['payment_id'],
                            'gel': cons['account_currency_amount'],
                            'nominal': cons['nominal_amount']
                        })
                
                found = True
                break
        except Exception as e:
            pass
    
    if not found:
        print(f"  ✗ Not found")
    print()

# Summary by payment_id
if found_txns:
    print(f"{'='*80}")
    print("SUMMARY BY PAYMENT ID:")
    print("=" * 80)
    
    from collections import defaultdict
    by_payment = defaultdict(lambda: {'count': 0, 'gel': 0, 'nominal': 0})
    
    for txn in found_txns:
        by_payment[txn['payment_id']]['count'] += 1
        by_payment[txn['payment_id']]['gel'] += float(txn['gel'] or 0)
        by_payment[txn['payment_id']]['nominal'] += float(txn['nominal'] or 0)
    
    for payment_id, data in by_payment.items():
        print(f"\n{payment_id}:")
        print(f"  Transactions: {data['count']}")
        print(f"  Total GEL: {data['gel']:,.2f}")
        print(f"  Total Nominal: {data['nominal']:,.2f}")
        
        # Get payment details
        cur.execute("""
            SELECT is_bundle_payment, fc.code as fc_code, c.name as ca_name
            FROM payments p
            LEFT JOIN financial_codes fc ON fc.uuid = p.financial_code_uuid
            LEFT JOIN counteragents c ON c.counteragent_uuid = p.counteragent_uuid
            WHERE p.payment_id = %s
        """, (payment_id,))
        
        pmt = cur.fetchone()
        if pmt:
            print(f"  Financial Code: {pmt['fc_code']}")
            print(f"  Counteragent: {pmt['ca_name']}")
            print(f"  Is Bundle: {pmt['is_bundle_payment']}")

conn.close()
print(f"\n{'='*80}\n")
conn.close()
print(f"\n{'='*80}\n")
