import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# The payment ID from the bank statement for record 3d946a71-8857-4afa-b8c0-1562c3f13bda
bank_payment_id = "NP_BE07B5_NJ_1BA0B4_PRL012024"

conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
cur = conn.cursor()

print(f"\n{'='*80}")
print(f"Checking for payment_id: {bank_payment_id}")
print(f"{'='*80}\n")

# Check case-insensitive match
cur.execute("""
    SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
    FROM salary_accruals
    WHERE LOWER(payment_id) = LOWER(%s)
""", (bank_payment_id,))

result = cur.fetchone()

if result:
    print("✅ MATCH FOUND in salary_accruals:")
    print(f"  Salary ID: {result[0]}")
    print(f"  Payment ID: {result[1]}")
    print(f"  Counteragent: {result[2]}")
    print(f"  Net Sum: {result[3]}")
    print(f"  Salary Month: {result[4]}")
    print(f"\n  Exact match? {result[1] == bank_payment_id}")
    print(f"  Case-insensitive match? {result[1].lower() == bank_payment_id.lower()}")
else:
    print("❌ NO MATCH FOUND in salary_accruals")
    print("\nSearching for similar payment IDs...")
    
    # Extract components
    parts = bank_payment_id.split('_')
    if len(parts) >= 5:
        np_part = parts[1]  # BE07B5
        nj_part = parts[3]  # 1BA0B4
        
        cur.execute("""
            SELECT id, payment_id, salary_month
            FROM salary_accruals
            WHERE payment_id ILIKE %s
            LIMIT 10
        """, (f'%{np_part}%',))
        
        similar = cur.fetchall()
        if similar:
            print(f"\n📋 Found {len(similar)} similar payment IDs with '{np_part}':")
            for row in similar:
                print(f"  ID {row[0]}: {row[1]} (Month: {row[2]})")
        else:
            print(f"  No payment IDs found containing '{np_part}'")

conn.close()
