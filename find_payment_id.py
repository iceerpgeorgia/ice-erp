import sqlite3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# The payment_id from the bank statement
bank_payment_id = "NP_BE07B5_NJ_1BA0B4_PRL012024"

print(f"\n🔍 Searching for payment_id: {bank_payment_id}")

# Connect to LOCAL database
local_url = os.getenv('DATABASE_URL')
# Remove pgbouncer parameter for psycopg2
if '?pgbouncer=' in local_url:
    local_url = local_url.split('?pgbouncer=')[0]

local_conn = psycopg2.connect(local_url)
local_cur = local_conn.cursor()

# Check exact match
local_cur.execute("""
    SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
    FROM salary_accruals
    WHERE payment_id = %s
""", (bank_payment_id,))

exact = local_cur.fetchone()
if exact:
    print(f"✅ EXACT MATCH:")
    print(f"  ID: {exact[0]}")
    print(f"  Payment ID: {exact[1]}")
    print(f"  Net Sum: {exact[2]}")
else:
    print(f"❌ No exact match")
    
    # Check case-insensitive
    local_cur.execute("""
        SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
        FROM salary_accruals
        WHERE LOWER(payment_id) = LOWER(%s)
    """, (bank_payment_id,))
    
    ci_match = local_cur.fetchone()
    if ci_match:
        print(f"✅ CASE-INSENSITIVE MATCH:")
        print(f"  ID: {ci_match[0]}")
        print(f"  Payment ID in DB: {ci_match[1]}")
        print(f"  Payment ID from bank: {bank_payment_id}")
        print(f"  Match? {ci_match[1].lower() == bank_payment_id.lower()}")
    else:
        print(f"❌ No case-insensitive match either")
        
        # Check for similar patterns
        local_cur.execute("""
            SELECT id, payment_id
            FROM salary_accruals
            WHERE payment_id LIKE %s
            LIMIT 5
        """, ('%BE07B5%',))
        
        similar = local_cur.fetchall()
        if similar:
            print(f"\n📋 Found similar payment IDs:")
            for row in similar:
                print(f"  ID {row[0]}: {row[1]}")
        else:
            print(f"\n❌ No similar patterns found")

local_conn.close()
