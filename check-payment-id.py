import psycopg2

# Check in LOCAL database
print("=== CHECKING LOCAL DATABASE ===")
conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
cur = conn.cursor()

payment_id = 'a6042a_48_b0e8b1'

# Check in payments table
cur.execute("SELECT payment_id FROM payments WHERE payment_id = %s", (payment_id,))
payment = cur.fetchone()
print(f"Payment exists in payments table: {payment is not None}")

# Search in ALL text fields of consolidated_bank_accounts
cur.execute("""
    SELECT id, uuid, payment_uuid, id_1, id_2, record_uuid, 
           account_currency_amount, nominal_amount, description
    FROM consolidated_bank_accounts 
    WHERE id_1 LIKE %s OR id_2 LIKE %s 
       OR record_uuid::text LIKE %s 
       OR description LIKE %s
    LIMIT 20
""", (f'%{payment_id}%', f'%{payment_id}%', f'%{payment_id}%', f'%{payment_id}%'))
bank_records = cur.fetchall()
print(f"\nBank transaction records containing '{payment_id}': {len(bank_records)}")
for record in bank_records:
    print(f"\n  id: {record[0]}")
    print(f"  uuid: {record[1]}")
    print(f"  payment_uuid: {record[2]}")
    print(f"  id_1: {record[3]}")
    print(f"  id_2: {record[4]}")
    print(f"  record_uuid: {record[5]}")
    print(f"  account_currency_amount: {record[6]}")
    print(f"  nominal_amount: {record[7]}")
    print(f"  description: {record[8][:100] if record[8] else None}")

cur.close()
conn.close()

# Check in consolidated_bank_accounts
cur.execute("""
    SELECT payment_uuid, account_currency_amount, nominal_amount 
    FROM consolidated_bank_accounts 
    WHERE payment_uuid::text = %s
""", (payment_id,))
bank_records = cur.fetchall()
print(f"\nBank transactions with this payment_id (exact match): {len(bank_records)}")

# Try with LIKE to see if there's a similar payment_uuid
cur.execute("""
    SELECT payment_uuid, account_currency_amount, nominal_amount 
    FROM consolidated_bank_accounts 
    WHERE payment_uuid::text LIKE %s
    LIMIT 5
""", (f'%{payment_id}%',))
similar_records = cur.fetchall()
print(f"\nBank transactions with similar payment_uuid: {len(similar_records)}")
for record in similar_records:
    print(f"  payment_uuid: {record[0]}, account_currency_amount: {record[1]}, nominal_amount: {record[2]}")

# Check if the format is different (maybe it's stored with dashes?)
cur.execute("""
    SELECT payment_uuid, account_currency_amount, nominal_amount 
    FROM consolidated_bank_accounts 
    WHERE payment_uuid IS NOT NULL
    LIMIT 10
""")
sample_records = cur.fetchall()
print(f"\nSample payment_uuid values in bank transactions:")
for record in sample_records:
    print(f"  {record[0]}")

for record in bank_records:
    print(f"  payment_uuid: {record[0]}, account_currency_amount: {record[1]}, nominal_amount: {record[2]}")

if bank_records:
    total_account = sum(float(r[1]) if r[1] else 0 for r in bank_records)
    total_nominal = sum(float(r[2]) if r[2] else 0 for r in bank_records)
    print(f"\nTotal account_currency_amount: {total_account}")
    print(f"Total nominal_amount: {total_nominal}")

cur.close()
conn.close()
