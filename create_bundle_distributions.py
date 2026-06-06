#!/usr/bin/env python3
"""
Create job distributions for bundle payment transactions from raw bank table.
Distribute by selling price weight across 4 jobs.
"""

import os
import psycopg2
import psycopg2.extras
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv('.env')

project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

raw_uuids = [
    'caa2cf8c-7009-5a48-8a3c-a1385c5084e4',  # 39dbcb_5e_a9dccc
    '6ec61407-6c08-5ccd-8847-0b4027ba9ae2',  # BTC_B8F991_9A_E5EE4F
    '1e7c1b98-0e9d-5fae-a9bf-7797d7fa5b7a',  # BTC_DEC51D_4E_5A5046
    '06f762fc-3ccc-573c-8f93-c18565a717b4',  # b993e2_ba_b36a2b
    '77501426-9a30-5b3f-842a-0270795db7c0'   # b993e2_ba_b36a2b
]

conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print(f"\n{'='*80}")
print(f"CREATE JOB DISTRIBUTIONS FROM RAW BANK TRANSACTIONS")
print(f"PROJECT: {project_uuid}")
print(f"{'='*80}\n")

# 1. Get transaction details from raw table
print("1. RAW TRANSACTIONS:")
print("-" * 80)

cur.execute("""
    SELECT 
        raw_record_uuid,
        payment_id,
        dockey,
        entriesid,
        account_currency_amount,
        nominal_amount
    FROM "GE65TB7856036050100002_TBC_GEL"
    WHERE raw_record_uuid::text = ANY(%s)
    ORDER BY dockey
""", (raw_uuids,))

raw_txns = cur.fetchall()

print(f"Found {len(raw_txns)} transaction(s):\n")
for txn in raw_txns:
    print(f"  DocKey: {txn['dockey']}, EntriesId: {txn['entriesid']}")
    print(f"    Payment ID: {txn['payment_id']}")
    print(f"    Amount (GEL): {txn['account_currency_amount']}")
    print(f"    Nominal: {txn['nominal_amount']}")
    print(f"    Raw UUID: {txn['raw_record_uuid']}")
    print()

# 2. Get jobs and calculate weights
print("2. JOBS AND DISTRIBUTION WEIGHTS:")
print("-" * 80)

cur.execute("""
    SELECT job_uuid, job_name, selling_price
    FROM jobs
    WHERE project_uuid = %s
    ORDER BY job_name
""", (project_uuid,))

jobs = cur.fetchall()
total_selling_price = sum(Decimal(str(j['selling_price'] or 0)) for j in jobs)

job_weights = {}
for job in jobs:
    sp = Decimal(str(job['selling_price'] or 0))
    weight = sp / total_selling_price if total_selling_price > 0 else Decimal('0')
    job_weights[job['job_uuid']] = {
        'name': job['job_name'],
        'selling_price': sp,
        'weight': weight
    }
    print(f"  {job['job_name']}: {weight * 100:.2f}% (${sp:,.2f})")

print()

# 3. Resolve payment UUIDs and handle batches
print("3. PAYMENT RESOLUTION:")
print("-" * 80)

transactions_to_distribute = []

for txn in raw_txns:
    payment_id = txn['payment_id']
    
    # Handle BTC_ batch IDs
    if payment_id and payment_id.startswith('BTC_'):
        print(f"  Batch {payment_id}: Resolving partitions...")
        
        cur.execute("""
            SELECT payment_id, payment_uuid
            FROM bank_transaction_batches
            WHERE raw_record_uuid = %s
            ORDER BY id
        """, (txn['raw_record_uuid'],))
        
        partitions = cur.fetchall()
        if partitions:
            print(f"    Found {len(partitions)} partition(s)")
            for p in partitions:
                print(f"      → {p['payment_id']}")
                transactions_to_distribute.append({
                    'raw_uuid': txn['raw_record_uuid'],
                    'payment_id': p['payment_id'],
                    'payment_uuid': p['payment_uuid'],
                    'amount_gel': Decimal(str(txn['account_currency_amount'] or 0)) / len(partitions),
                    'amount_nominal': Decimal(str(txn['nominal_amount'] or 0)) / len(partitions)
                })
        else:
            print(f"    ✗ No partitions found - skipping")
    else:
        # Regular payment
        cur.execute("""
            SELECT record_uuid
            FROM payments
            WHERE payment_id = %s
        """, (payment_id,))
        
        pmt = cur.fetchone()
        if pmt:
            print(f"  {payment_id}: ✓ Found")
            transactions_to_distribute.append({
                'raw_uuid': txn['raw_record_uuid'],
                'payment_id': payment_id,
                'payment_uuid': pmt['record_uuid'],
                'amount_gel': Decimal(str(txn['account_currency_amount'] or 0)),
                'amount_nominal': Decimal(str(txn['nominal_amount'] or 0))
            })
        else:
            print(f"  {payment_id}: ✗ Payment not found - skipping")

print()

# 4. Calculate distributions
print("4. CALCULATED DISTRIBUTIONS:")
print("-" * 80)

distributions = []

for txn in transactions_to_distribute:
    print(f"\n  {txn['payment_id']}")
    print(f"  Total: {txn['amount_nominal']:,.2f} nominal / {txn['amount_gel']:,.2f} GEL\n")
    
    for job_uuid, job_info in job_weights.items():
        nominal_share = txn['amount_nominal'] * job_info['weight']
        gel_share = txn['amount_gel'] * job_info['weight']
        
        distributions.append({
            'payment_uuid': txn['payment_uuid'],
            'payment_id': txn['payment_id'],
            'raw_uuid': txn['raw_uuid'],
            'job_uuid': job_uuid,
            'job_name': job_info['name'],
            'amount': nominal_share,
            'amount_account_curr': gel_share,
            'allocation_percent': job_info['weight'] * 100
        })
        
        print(f"    {job_info['name']}: {nominal_share:,.2f} / {gel_share:,.2f} GEL ({job_info['weight'] * 100:.2f}%)")

# 5. Confirm and insert
print(f"\n5. CONFIRMATION:")
print("-" * 80)
print(f"  This will create {len(distributions)} distribution records")
print(f"  ({len(transactions_to_distribute)} payments × {len(jobs)} jobs)")
print()
response = input("  Proceed? (yes/no): ")

if response.lower() != 'yes':
    print("\n  Aborted.")
    conn.close()
    exit(0)

# 6. Insert
print("\n6. CREATING DISTRIBUTIONS:")
print("-" * 80)

inserted = 0
for dist in distributions:
    try:
        cur.execute("""
            INSERT INTO payments_jobs (
                payment_uuid,
                job_uuid,
                project_uuid,
                raw_record_uuid,
                amount,
                amount_account_curr,
                allocation_type,
                allocation_percent,
                is_auto_distributed,
                created_at,
                updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (
            dist['payment_uuid'],
            dist['job_uuid'],
            project_uuid,
            dist['raw_uuid'],
            dist['amount'],
            dist['amount_account_curr'],
            'nominal',
            dist['allocation_percent'],
            True
        ))
        inserted += 1
        print(f"  ✓ {dist['payment_id']} → {dist['job_name']}")
    except Exception as e:
        print(f"  ✗ {dist['payment_id']} → {dist['job_name']}: {e}")

conn.commit()

print(f"\n  Inserted: {inserted}/{len(distributions)} distributions")

conn.close()
print(f"\n{'='*80}\n")
print("DONE!")
