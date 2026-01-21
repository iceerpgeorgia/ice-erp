import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*60)
print("INVESTIGATING RECORD ID 329679")
print("="*60)

# Check consolidated_bank_accounts table
print("\n1. CONSOLIDATED TABLE DATA:")
cur.execute("""
    SELECT id, payment_id, counteragent_name, doc_information, 
           transaction_date, debit, credit, raw_table_name
    FROM consolidated_bank_accounts 
    WHERE id = 329679
""")
row = cur.fetchone()

if row:
    print(f"   Record ID: {row[0]}")
    print(f"   Payment ID: {row[1]}")
    print(f"   Counteragent: {row[2]}")
    print(f"   DocInformation: {row[3]}")
    print(f"   Transaction Date: {row[4]}")
    print(f"   Debit: {row[5]}")
    print(f"   Credit: {row[6]}")
    print(f"   Raw Table: {row[7]}")
else:
    print("   ❌ Record not found in consolidated_bank_accounts")

# Check raw table to find matching record
print("\n2. FINDING CORRESPONDING RAW RECORD:")
cur.execute("""
    SELECT doc_key, entries_id, doc_information, 
           counteragent_processed, parsing_rule_processed, 
           payment_id_processed, is_processed, counteragent_inn
    FROM bog_gel_raw_893486000
    ORDER BY id
    LIMIT 1 OFFSET 329678
""")
raw_row = cur.fetchone()

if raw_row:
    print(f"   DocKey: {raw_row[0]}")
    print(f"   EntriesId: {raw_row[1]}")
    print(f"   DocInformation: {raw_row[2]}")
    print(f"   counteragent_processed: {raw_row[3]}")
    print(f"   parsing_rule_processed: {raw_row[4]}")
    print(f"   payment_id_processed: {raw_row[5]}")
    print(f"   is_processed: {raw_row[6]}")
    print(f"   counteragent_inn: {raw_row[7]}")

# Check overall statistics
print("\n3. OVERALL PAYMENT ID STATISTICS:")
cur.execute("""
    SELECT 
        COUNT(*) as total,
        COUNT(payment_id) as with_payment_id,
        COUNT(CASE WHEN payment_id LIKE 'NP_%_NJ_%_PRL%' THEN 1 END) as salary_format
    FROM consolidated_bank_accounts
""")
stats = cur.fetchone()
print(f"   Total records: {stats[0]}")
print(f"   Records with payment_id: {stats[1]} ({stats[1]*100//stats[0]}%)")
print(f"   Salary format (NP_xxx_NJ_xxx_PRLxxx): {stats[2]}")

# Sample some salary payment IDs
print("\n4. SAMPLE SALARY PAYMENT IDs IN DATABASE:")
cur.execute("""
    SELECT id, payment_id, doc_information
    FROM consolidated_bank_accounts
    WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
    LIMIT 5
""")
samples = cur.fetchall()
for s in samples:
    print(f"   ID {s[0]}: {s[1]}")

cur.close()
conn.close()

print("\n" + "="*60)
