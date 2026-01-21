import psycopg2
import os

# Let's read .env.local file directly to avoid the null character issue
env_file = '.env.local'
database_url = None

with open(env_file, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('DATABASE_URL='):
            database_url = line.split('=', 1)[1].strip('"').strip("'")
            break

if not database_url:
    print("❌ DATABASE_URL not found in .env.local")
    exit(1)

# Remove pgbouncer parameter which psycopg2 doesn't understand
database_url = database_url.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '')

print(f"Using DATABASE_URL: {database_url[:50]}...")

try:
    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    print("\n" + "="*70)
    print("DATABASE CONNECTION TEST")
    print("="*70)

    # Check total records
    print("\n1. TOTAL RECORDS:")
    cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
    total = cur.fetchone()[0]
    print(f"   Total records: {total:,}")

    # Check records with payment_id
    print("\n2. RECORDS WITH PAYMENT_ID:")
    cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts WHERE payment_id IS NOT NULL")
    with_payment = cur.fetchone()[0]
    print(f"   Records with payment_id: {with_payment:,} ({with_payment*100//total if total > 0 else 0}%)")

    # Check salary format
    print("\n3. SALARY FORMAT PAYMENT IDS:")
    cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'")
    salary_count = cur.fetchone()[0]
    print(f"   Salary format count: {salary_count:,}")

    # Sample records with payment_id
    print("\n4. SAMPLE RECORDS WITH PAYMENT_ID:")
    cur.execute("""
        SELECT id, payment_id, doc_information 
        FROM consolidated_bank_accounts 
        WHERE payment_id IS NOT NULL 
        ORDER BY id 
        LIMIT 10
    """)
    samples = cur.fetchall()
    for s in samples:
        doc_info = s[2][:50] if s[2] else 'NULL'
        print(f"   ID {s[0]}: payment_id='{s[1]}', doc_info='{doc_info}'")

    # Check specific record 329679
    print("\n5. SPECIFIC RECORD 329679:")
    cur.execute("""
        SELECT id, payment_id, doc_information, counteragent_name, transaction_date
        FROM consolidated_bank_accounts 
        WHERE id = 329679
    """)
    row = cur.fetchone()
    if row:
        print(f"   ID: {row[0]}")
        print(f"   Payment ID: {row[1]}")
        print(f"   DocInformation: {row[2]}")
        print(f"   Counteragent: {row[3]}")
        print(f"   Transaction Date: {row[4]}")
    else:
        print("   ❌ Record not found!")

    # Check raw table
    print("\n6. RAW TABLE STATUS:")
    cur.execute("SELECT COUNT(*) FROM bog_gel_raw_893486000")
    raw_total = cur.fetchone()[0]
    print(f"   Total raw records: {raw_total:,}")
    
    cur.execute("SELECT COUNT(*) FROM bog_gel_raw_893486000 WHERE payment_id_processed = TRUE")
    processed_count = cur.fetchone()[0]
    print(f"   payment_id_processed=TRUE: {processed_count:,}")

    cur.close()
    conn.close()

    print("\n" + "="*70)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
