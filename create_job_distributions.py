#!/usr/bin/env python3
"""
Create job distributions for salary/bonus bank payments proportional to job selling prices.
"""

import os
import psycopg2
import psycopg2.extras
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"CREATE JOB DISTRIBUTIONS FOR SALARY/BONUS PAYMENTS")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Get all jobs and calculate distribution weights
print("1. JOBS AND DISTRIBUTION WEIGHTS:")
print("-" * 80)
cur.execute("""
    SELECT job_uuid, job_name, selling_price, weight
    FROM jobs
    WHERE project_uuid = %s
    ORDER BY job_name
""", (project_uuid,))
jobs = cur.fetchall()

total_selling_price = sum(Decimal(str(j['selling_price'] or 0)) for j in jobs)
print(f"Total Selling Price: ${total_selling_price:,.2f}\n")

job_weights = {}
for job in jobs:
    sp = Decimal(str(job['selling_price'] or 0))
    weight = sp / total_selling_price if total_selling_price > 0 else Decimal('0')
    job_weights[job['job_uuid']] = {
        'name': job['job_name'],
        'selling_price': sp,
        'weight': weight
    }
    print(f"  {job['job_name']}")
    print(f"    Selling Price: ${sp:,.2f}")
    print(f"    Weight: {weight * 100:.2f}%")
    print()

# 2. Get bank transactions grouped by payment_id
print("2. BANK TRANSACTIONS TO DISTRIBUTE:")
print("-" * 80)
cur.execute("""
    SELECT 
        cba.payment_id,
        p.record_uuid as payment_uuid,
        fc.code as financial_code,
        c.name as counteragent,
        COUNT(*) as txn_count,
        SUM(cba.account_currency_amount) as total_gel,
        SUM(cba.nominal_amount) as total_nominal
    FROM consolidated_bank_accounts cba
    JOIN payments p ON p.payment_id = cba.payment_id
    LEFT JOIN financial_codes fc ON fc.uuid = cba.financial_code_uuid
    LEFT JOIN counteragents c ON c.counteragent_uuid = cba.counteragent_uuid
    WHERE cba.project_uuid = %s
    AND cba.payment_id IS NOT NULL
    AND cba.payment_id NOT LIKE 'BTC_%%'
    GROUP BY cba.payment_id, p.record_uuid, fc.code, c.name
    ORDER BY cba.payment_id
""", (project_uuid,))
payments_to_distribute = cur.fetchall()

print(f"Found {len(payments_to_distribute)} payment IDs to distribute:\n")
for pmt in payments_to_distribute:
    print(f"  {pmt['payment_id']} ({pmt['financial_code']}) - {pmt['counteragent']}")
    print(f"    Total GEL: {pmt['total_gel']:,.2f}")
    print(f"    Total Nominal: {pmt['total_nominal']:,.2f}")
    print()

# 3. Calculate distributions
print("3. CALCULATED DISTRIBUTIONS:")
print("-" * 80)
distributions = []

for pmt in payments_to_distribute:
    total_nominal = Decimal(str(pmt['total_nominal']))
    total_gel = Decimal(str(pmt['total_gel']))
    
    print(f"\n  {pmt['payment_id']} - {pmt['counteragent']}")
    print(f"  Total to distribute: {total_nominal:,.2f} nominal / {total_gel:,.2f} GEL")
    print(f"  Distribution by job:\n")
    
    for job_uuid, job_info in job_weights.items():
        nominal_share = total_nominal * job_info['weight']
        gel_share = total_gel * job_info['weight']
        
        distributions.append({
            'payment_uuid': pmt['payment_uuid'],
            'payment_id': pmt['payment_id'],
            'job_uuid': job_uuid,
            'job_name': job_info['name'],
            'amount': nominal_share,
            'amount_account_curr': gel_share,
            'allocation_percent': job_info['weight'] * 100
        })
        
        print(f"    {job_info['name']}: {nominal_share:,.2f} nominal / {gel_share:,.2f} GEL ({job_info['weight'] * 100:.2f}%)")

# 4. Confirm and insert
print(f"\n4. CONFIRMATION:")
print("-" * 80)
print(f"  This will create {len(distributions)} distribution records")
print(f"  ({len(payments_to_distribute)} payments × {len(jobs)} jobs)")
print()
response = input("  Proceed with creating distributions? (yes/no): ")

if response.lower() != 'yes':
    print("\n  Aborted. No changes made.")
    conn.close()
    exit(0)

# 5. Insert distributions
print("\n5. CREATING DISTRIBUTIONS:")
print("-" * 80)

inserted = 0
for dist in distributions:
    try:
        cur.execute("""
            INSERT INTO payments_jobs (
                payment_uuid,
                job_uuid,
                project_uuid,
                amount,
                amount_account_curr,
                allocation_type,
                allocation_percent,
                is_auto_distributed
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            dist['payment_uuid'],
            dist['job_uuid'],
            project_uuid,
            dist['amount'],
            dist['amount_account_curr'],
            'nominal',
            dist['allocation_percent'],
            True
        ))
        inserted += 1
        print(f"  ✓ {dist['payment_id']} → {dist['job_name']}: {dist['amount']:,.2f}")
    except Exception as e:
        print(f"  ✗ {dist['payment_id']} → {dist['job_name']}: {e}")

conn.commit()

# 6. Verify
print(f"\n6. VERIFICATION:")
print("-" * 80)
cur.execute("""
    SELECT COUNT(*) as cnt,
           SUM(amount_account_curr) as total_gel,
           SUM(amount) as total_nominal
    FROM payments_jobs
    WHERE project_uuid = %s
""", (project_uuid,))
result = cur.fetchone()

print(f"  Inserted: {inserted} distributions")
print(f"  Total in payments_jobs: {result['cnt']} rows")
print(f"  Total GEL: {result['total_gel']:,.2f}")
print(f"  Total Nominal: {result['total_nominal']:,.2f}")

# Compare with bank
cur.execute("""
    SELECT 
        SUM(account_currency_amount) as bank_gel,
        SUM(nominal_amount) as bank_nominal
    FROM consolidated_bank_accounts
    WHERE project_uuid = %s
    AND payment_id IS NOT NULL
    AND payment_id NOT LIKE 'BTC_%%'
""", (project_uuid,))
bank = cur.fetchone()

print(f"\n  Bank Total GEL: {bank['bank_gel']:,.2f}")
print(f"  Bank Total Nominal: {bank['bank_nominal']:,.2f}")
print(f"  Match: {'✓ YES' if result['total_gel'] == bank['bank_gel'] else '✗ NO'}")

conn.close()
print(f"\n{'='*80}\n")
print("DISTRIBUTIONS CREATED!")
