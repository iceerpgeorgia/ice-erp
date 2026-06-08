#!/usr/bin/env python3
"""Fix the 8.57 GEL gap in batch partition 5900bd9c-99c8-4ac8-ad30-e353f2d37beb"""

import os
import psycopg2
from decimal import Decimal
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.environ['DIRECT_URL'])
cur = conn.cursor()

partition_uuid = '5900bd9c-99c8-4ac8-ad30-e353f2d37beb'
payment_uuid = 'c0c2d3aa-e15c-4da4-b15e-32b0aa00a02a'  # Will query from batch
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

print("=== Fixing 8.57 GEL Gap ===\n")

# Get batch partition details
cur.execute('''
SELECT 
  uuid,
  partition_amount,
  nominal_amount,
  payment_uuid,
  raw_record_uuid
FROM bank_transaction_batches
WHERE uuid::text = %s::text
''', (partition_uuid,))

batch = cur.fetchone()
if not batch:
    print("Batch partition not found!")
    conn.close()
    exit(1)

uuid, partition_amount, nominal_amount, batch_payment_uuid, raw_record_uuid = batch
payment_uuid = batch_payment_uuid
print(f"Batch UUID: {uuid}")
print(f"Partition amount: {partition_amount}")
print(f"Nominal amount: {nominal_amount}")
print(f"Payment UUID: {payment_uuid}")
print()

# Get current distributions
cur.execute('''
SELECT 
  pj.uuid,
  pj.job_uuid,
  j.job_name,
  j.selling_price,
  pj.amount_account_curr,
  pj.amount
FROM payments_jobs pj
LEFT JOIN jobs j ON j.job_uuid = pj.job_uuid
WHERE pj.batch_partition_uuid::text = %s::text
ORDER BY j.selling_price DESC
''', (partition_uuid,))

current_dists = cur.fetchall()
print(f"Current distributions ({len(current_dists)} jobs):")

total_selling_price = 0
current_total = Decimal('0')

for uuid, job_uuid, job_name, selling_price, amount_acc, amount in current_dists:
    print(f"  {job_name}: selling_price={selling_price} current_amount={amount_acc}")
    if selling_price:
        total_selling_price += float(selling_price or 0)
    if amount_acc:
        current_total += Decimal(str(amount_acc))

print(f"\nTotal distributed: {current_total}")
print(f"Batch amount: {partition_amount}")
print(f"Gap: {float(partition_amount) - float(current_total):.2f}")

# Recalculate with proper weighting
print(f"\n=== Recalculating distributions ===")
print(f"Total selling price: {total_selling_price}")

# Calculate new distributions based on weight
new_distributions = []
total_new = Decimal('0')

for uuid, job_uuid, job_name, selling_price, _, _ in current_dists:
    if total_selling_price > 0 and selling_price:
        weight = float(selling_price) / total_selling_price
        new_amount = Decimal(str(partition_amount)) * Decimal(str(weight))
        new_amount = new_amount.quantize(Decimal('0.01'))  # Round to 2 decimals
    else:
        new_amount = Decimal('0')
    
    new_distributions.append({
        'uuid': uuid,
        'job_uuid': job_uuid,
        'job_name': job_name,
        'selling_price': selling_price,
        'old_amount': Decimal(str(_)) if _ else Decimal('0'),
        'new_amount': new_amount,
    })
    total_new += new_amount
    print(f"  {job_name}: weight={weight:.4f} new_amount={new_amount}")

print(f"\nTotal calculated: {total_new}")
gap = Decimal(str(partition_amount)) - total_new
print(f"Remaining gap after calculation: {gap}")

# Apply rounding correction to first job
if abs(gap) > Decimal('0.01') and new_distributions:
    print(f"\nApplying rounding correction of {gap} to {new_distributions[0]['job_name']}")
    new_distributions[0]['new_amount'] += gap
    total_new = Decimal('0')
    for d in new_distributions:
        total_new += d['new_amount']
    print(f"Final total: {total_new}")

# Update distributions in database
print(f"\n=== Updating database ===")
for dist in new_distributions:
    print(f"Updating {dist['job_name']}: {dist['old_amount']} → {dist['new_amount']}")
    cur.execute('''
    UPDATE payments_jobs
    SET 
      amount_account_curr = %s,
      updated_by = 'system-gap-fix'
    WHERE uuid::text = %s::text
    ''', (float(dist['new_amount']), dist['uuid']))

conn.commit()
print("\n✓ Database updated!")

# Verify
cur.execute('''
SELECT 
  COALESCE(SUM(amount_account_curr), 0) as total_dist
FROM payments_jobs
WHERE batch_partition_uuid::text = %s::text
''', (partition_uuid,))

result = cur.fetchone()
verified_total = result[0]
print(f"\nVerification:")
print(f"  Expected: {float(partition_amount):.2f}")
print(f"  Actual: {float(verified_total):.2f}")
print(f"  Gap: {abs(float(partition_amount) - float(verified_total)):.2f}")

if abs(float(partition_amount) - float(verified_total)) < 0.01:
    print("✓ GAP FIXED!")
else:
    print("⚠ Gap still exists!")

conn.close()
