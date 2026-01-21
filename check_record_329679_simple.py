import psycopg2
import os

# Read DATABASE_URL from environment (assumes it's already set or we'll use direct value)
# Using session mode connection string from Supabase
conn_string = "postgresql://postgres.gpxmmzwqompphtytqfav:IceErpG24@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"

print("\n" + "="*70)
print("INVESTIGATING RECORD ID 329679")
print("="*70)

try:
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()

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
        
        if row[1] is None:
            print("\n   ⚠️  PROBLEM: payment_id is NULL!")
        else:
            print(f"\n   ✅ Payment ID is populated: {row[1]}")
    else:
        print("   ❌ Record not found in consolidated_bank_accounts")

    # Check overall statistics
    print("\n2. OVERALL PAYMENT ID STATISTICS:")
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(payment_id) as with_payment_id,
            COUNT(CASE WHEN payment_id LIKE 'NP_%_NJ_%_PRL%' THEN 1 END) as salary_format
        FROM consolidated_bank_accounts
    """)
    stats = cur.fetchone()
    print(f"   Total records: {stats[0]:,}")
    print(f"   Records with payment_id: {stats[1]:,} ({stats[1]*100//stats[0]}%)")
    print(f"   Salary format (NP_xxx_NJ_xxx_PRLxxx): {stats[2]:,}")

    # Sample some salary payment IDs
    print("\n3. SAMPLE SALARY PAYMENT IDs IN DATABASE:")
    cur.execute("""
        SELECT id, payment_id, doc_information
        FROM consolidated_bank_accounts
        WHERE payment_id LIKE 'NP_%_NJ_%_PRL%'
        LIMIT 5
    """)
    samples = cur.fetchall()
    if samples:
        for s in samples:
            print(f"   ID {s[0]}: {s[1]}")
    else:
        print("   ⚠️  No salary format payment IDs found!")

    # Check if record 329679 has DocInformation that looks like salary payment ID
    print("\n4. CHECKING RECORD 329679 RAW DATA:")
    if row and row[3]:  # DocInformation
        doc_info = row[3]
        print(f"   DocInformation: {doc_info}")
        
        import re
        salary_pattern = r'NP_[A-F0-9]{6}_NJ_[A-F0-9]{6}_PRL\d{6}'
        if re.search(salary_pattern, doc_info, re.IGNORECASE):
            print("   ✅ Matches salary payment ID pattern!")
            match = re.search(salary_pattern, doc_info, re.IGNORECASE)
            extracted = match.group(0).upper()
            print(f"   Extracted: {extracted}")
            if row[1] != extracted:
                print(f"   ❌ BUT payment_id column has: {row[1]}")
                print("   🔥 MISMATCH DETECTED!")
        else:
            print("   ℹ️  Does not match salary payment ID pattern")

    cur.close()
    conn.close()

    print("\n" + "="*70)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
