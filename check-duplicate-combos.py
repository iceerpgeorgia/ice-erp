#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.vercel.production')

db_url = os.getenv('DATABASE_URL').split('?')[0] if '?' in os.getenv('DATABASE_URL') else os.getenv('DATABASE_URL')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("=" * 80)
print("CHECKING FOR DUPLICATE PAYMENT_ID + EFFECTIVE_DATE COMBINATIONS")
print("=" * 80)

# Find combinations that appear more than once
cur.execute("""
    SELECT payment_id, effective_date, COUNT(*) as cnt,
           SUM(CASE WHEN accrual != 0 THEN 1 ELSE 0 END) as accrual_count,
           SUM(CASE WHEN "order" != 0 THEN 1 ELSE 0 END) as order_count,
           SUM(accrual) as total_accrual,
           SUM("order") as total_order
    FROM payments_ledger
    GROUP BY payment_id, effective_date
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
""")

duplicates = cur.fetchall()

if duplicates:
    print(f"\n✓ Found {len(duplicates)} payment_id + date combinations with multiple records")
    print(f"\nTop 10 examples:")
    for i, dup in enumerate(duplicates[:10], 1):
        payment_id, date, count, accrual_cnt, order_cnt, total_accrual, total_order = dup
        print(f"{i}. Payment: {payment_id}, Date: {date}")
        print(f"   Records: {count}, Accrual records: {accrual_cnt}, Order records: {order_cnt}")
        print(f"   Total accrual: {total_accrual}, Total order: {total_order}")
    
    print(f"\n📊 Summary:")
    total_records_now = sum(d[2] for d in duplicates)
    records_after_consolidation = len(duplicates)
    will_remove = total_records_now - records_after_consolidation
    print(f"   Records that will be consolidated: {total_records_now}")
    print(f"   Will become: {records_after_consolidation} records")
    print(f"   Will remove: {will_remove} duplicate records")
else:
    print("\n✓ No duplicate payment_id + date combinations found")

cur.close()
conn.close()

print("\n" + "=" * 80)
