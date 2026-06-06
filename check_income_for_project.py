#!/usr/bin/env python3
"""
Search consolidated_bank_accounts for potential bundle payment transactions.
Focusing on income (credit) transactions for project a7380446-a51d-44c2-abf1-0d3a9899d3a2
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"INCOME (CREDIT) TRANSACTIONS FOR PROJECT")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# Look for INCOME transactions (positive amounts, or FC starting with 1)
cur.execute("""
    SELECT 
        cba.id,
        cba.transaction_date,
        cba.account_currency_amount,
        cba.nominal_amount,
        cba.payment_id,
        cba.description,
        cba.raw_record_uuid,
        fc.code as financial_code,
        c.name as counteragent
    FROM consolidated_bank_accounts cba
    LEFT JOIN financial_codes fc ON fc.uuid = cba.financial_code_uuid
    LEFT JOIN counteragents c ON c.counteragent_uuid = cba.counteragent_uuid
    WHERE cba.project_uuid = %s
    AND (cba.account_currency_amount > 0 OR fc.code LIKE '1%%')
    ORDER BY cba.transaction_date, cba.id
""", (project_uuid,))

income_txns = cur.fetchall()

if income_txns:
    print(f"Found {len(income_txns)} INCOME transaction(s):\n")
    
    total_gel = 0
    total_nominal = 0
    
    for txn in income_txns:
        print(f"ID: {txn['id']}")
        print(f"  Date: {txn['transaction_date']}")
        print(f"  GEL: {txn['account_currency_amount']:,.2f}")
        print(f"  Nominal: {txn['nominal_amount']:,.2f}")
        print(f"  Payment ID: {txn['payment_id']}")
        print(f"  Financial Code: {txn['financial_code']}")
        print(f"  Counteragent: {txn['counteragent']}")
        print(f"  Description: {txn['description'][:100] if txn['description'] else 'N/A'}")
        print(f"  Raw UUID: {txn['raw_record_uuid']}")
        print()
        
        total_gel += float(txn['account_currency_amount'] or 0)
        total_nominal += float(txn['nominal_amount'] or 0)
    
    print(f"TOTAL INCOME:")
    print(f"  GEL: {total_gel:,.2f}")
    print(f"  Nominal: {total_nominal:,.2f}")
    
    # Group by payment_id
    print(f"\n{'='*80}")
    print("BY PAYMENT ID:")
    print("=" * 80)
    
    cur.execute("""
        SELECT 
            cba.payment_id,
            COUNT(*) as txn_count,
            SUM(cba.account_currency_amount) as total_gel,
            SUM(cba.nominal_amount) as total_nominal,
            fc.code as financial_code,
            c.name as counteragent
        FROM consolidated_bank_accounts cba
        LEFT JOIN financial_codes fc ON fc.uuid = cba.financial_code_uuid
        LEFT JOIN counteragents c ON c.counteragent_uuid = cba.counteragent_uuid
        WHERE cba.project_uuid = %s
        AND (cba.account_currency_amount > 0 OR fc.code LIKE '1%%')
        GROUP BY cba.payment_id, fc.code, c.name
        ORDER BY cba.payment_id
    """, (project_uuid,))
    
    by_payment = cur.fetchall()
    
    for pmt in by_payment:
        print(f"\n{pmt['payment_id'] or 'NULL'}:")
        print(f"  Transactions: {pmt['txn_count']}")
        print(f"  Total GEL: {pmt['total_gel']:,.2f}")
        print(f"  Total Nominal: {pmt['total_nominal']:,.2f}")
        print(f"  FC: {pmt['financial_code']}")
        print(f"  Counteragent: {pmt['counteragent']}")
        
        # Check if this is a bundle payment
        if pmt['payment_id']:
            cur.execute("""
                SELECT is_bundle_payment
                FROM payments
                WHERE payment_id = %s
            """, (pmt['payment_id'],))
            
            p = cur.fetchone()
            if p:
                print(f"  Is Bundle: {p['is_bundle_payment']}")
else:
    print("  ✗ NO INCOME transactions found for this project")

conn.close()
print(f"\n{'='*80}\n")
