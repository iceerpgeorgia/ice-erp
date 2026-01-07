import psycopg2

conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
cur = conn.cursor()

print("=== CHECKING PAYMENT TABLE STRUCTURE ===")
cur.execute("""
    SELECT payment_id, record_uuid 
    FROM payments 
    WHERE payment_id = 'a6042a_48_b0e8b1'
""")
result = cur.fetchone()
if result:
    print(f"payment_id: {result[0]}")
    print(f"record_uuid: {result[1]}")
    print(f"record_uuid type: {type(result[1])}")
else:
    print("Payment not found")

print("\n=== CHECKING IF record_uuid matches payment_uuid ===")
if result:
    record_uuid = result[1]
    cur.execute("""
        SELECT id, payment_uuid, account_currency_amount, nominal_amount
        FROM consolidated_bank_accounts
        WHERE payment_uuid = %s
    """, (record_uuid,))
    bank_records = cur.fetchall()
    print(f"Found {len(bank_records)} bank records matching record_uuid")
    for record in bank_records:
        print(f"  id: {record[0]}, payment_uuid: {record[1]}")
        print(f"  account_currency_amount: {record[2]}, nominal_amount: {record[3]}")
    
    if bank_records:
        total = sum(float(r[2]) if r[2] else 0 for r in bank_records)
        print(f"\nTotal account_currency_amount: {total}")

print("\n=== VERIFYING UNIQUENESS ===")
cur.execute("""
    SELECT 
        p.payment_id,
        p.record_uuid,
        COUNT(cba.id) as bank_record_count,
        SUM(cba.account_currency_amount) as total_payment
    FROM payments p
    LEFT JOIN consolidated_bank_accounts cba ON cba.payment_uuid = p.record_uuid
    WHERE cba.payment_uuid IS NOT NULL
    GROUP BY p.payment_id, p.record_uuid
    HAVING COUNT(cba.id) > 0
    LIMIT 10
""")
results = cur.fetchall()
print(f"Sample payments with bank transactions (using record_uuid join):")
for row in results:
    print(f"  payment_id: {row[0]}, record_uuid: {row[1]}, bank_records: {row[2]}, total: {row[3]}")

print("\n=== CHECKING FOR DUPLICATE payment_uuid ===")
cur.execute("""
    SELECT payment_uuid, COUNT(*) as count
    FROM consolidated_bank_accounts
    WHERE payment_uuid IS NOT NULL
    GROUP BY payment_uuid
    HAVING COUNT(*) > 1
    LIMIT 5
""")
duplicates = cur.fetchall()
print(f"Payment UUIDs with multiple bank records: {len(duplicates)}")
for dup in duplicates:
    print(f"  payment_uuid: {dup[0]}, count: {dup[1]}")

cur.close()
conn.close()
