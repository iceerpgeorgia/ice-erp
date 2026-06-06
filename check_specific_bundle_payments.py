#!/usr/bin/env python3
"""
Check bank transactions for specific bundle payment IDs.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'
payment_ids = [
    '39dbcb_5e_a9dccc',
    '51a575_51_bcfcf5',
    'b993e2_ba_b36a2b'
]

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"BANK TRANSACTIONS FOR SPECIFIC BUNDLE PAYMENT IDs")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

for payment_id in payment_ids:
    print(f"\nPayment ID: {payment_id}")
    print("-" * 80)
    
    # Check in consolidated_bank_accounts
    cur.execute("""
        SELECT 
            id,
            transaction_date,
            account_currency_amount,
            nominal_amount,
            description,
            raw_record_uuid
        FROM consolidated_bank_accounts
        WHERE payment_id = %s
        ORDER BY transaction_date
    """, (payment_id,))
    
    txns = cur.fetchall()
    
    if txns:
        print(f"  ✓ Found {len(txns)} transaction(s):\n")
        total_gel = 0
        total_nominal = 0
        
        for txn in txns:
            print(f"    Date: {txn['transaction_date']}")
            print(f"    GEL: {txn['account_currency_amount']:,.2f}")
            print(f"    Nominal: {txn['nominal_amount']:,.2f}")
            print(f"    Description: {txn['description']}")
            print(f"    Raw UUID: {txn['raw_record_uuid']}")
            print()
            
            if txn['account_currency_amount']:
                total_gel += float(txn['account_currency_amount'])
            if txn['nominal_amount']:
                total_nominal += float(txn['nominal_amount'])
        
        print(f"  TOTAL for {payment_id}:")
        print(f"    GEL: {total_gel:,.2f}")
        print(f"    Nominal: {total_nominal:,.2f}")
    else:
        print(f"  ✗ No transactions found")

# Summary
print(f"\n{'='*80}")
print("SUMMARY:")
print("=" * 80)

cur.execute("""
    SELECT 
        payment_id,
        COUNT(*) as txn_count,
        SUM(account_currency_amount) as total_gel,
        SUM(nominal_amount) as total_nominal,
        MIN(transaction_date) as first_date,
        MAX(transaction_date) as last_date
    FROM consolidated_bank_accounts
    WHERE payment_id = ANY(%s)
    GROUP BY payment_id
    ORDER BY payment_id
""", (payment_ids,))

summary = cur.fetchall()

if summary:
    print(f"\nFound transactions for {len(summary)} payment ID(s):\n")
    grand_total_gel = 0
    grand_total_nominal = 0
    
    for row in summary:
        print(f"  {row['payment_id']}")
        print(f"    Transactions: {row['txn_count']}")
        print(f"    Total GEL: {row['total_gel']:,.2f}")
        print(f"    Total Nominal: {row['total_nominal']:,.2f}")
        print(f"    Date Range: {row['first_date']} to {row['last_date']}")
        print()
        
        grand_total_gel += float(row['total_gel'])
        grand_total_nominal += float(row['total_nominal'])
    
    print(f"  GRAND TOTAL:")
    print(f"    GEL: {grand_total_gel:,.2f}")
    print(f"    Nominal: {grand_total_nominal:,.2f}")
else:
    print("\n  ✗ No transactions found for any of these payment IDs")

conn.close()
print(f"\n{'='*80}\n")
