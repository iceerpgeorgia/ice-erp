import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
cur = conn.cursor()

# The specific transaction - use raw_record_uuid
raw_uuid = '3d946a71-8857-4afa-b8c0-1562c3f13bda'

cur.execute("""
    SELECT payment_id, counteragent_uuid
    FROM consolidated_bank_accounts
    WHERE raw_record_uuid = %s
""", (raw_uuid,))

result = cur.fetchone()

print(f"\n{'='*80}")
print(f"Consolidated Record for raw_record_uuid={raw_uuid}")
print(f"{'='*80}\n")

if result:
    payment_id = result[0]
    counteragent = result[1]
    
    print(f"✅ Record found:")
    print(f"  payment_id: {payment_id or 'NULL'}")
    print(f"  counteragent_uuid: {counteragent}")
    
    if payment_id:
        print(f"\n🎉 SUCCESS! Payment ID was matched and stored!")
        print(f"  The salary payment ID '{payment_id}' is now in consolidated table")
    else:
        print(f"\n⚠️  Payment ID is NULL - it was NOT matched during processing")
else:
    print("❌ No consolidated record found")

conn.close()
