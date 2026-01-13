from import_bank_xml_data import get_db_connections
import sys

print("=" * 80)
print("TRUNCATING AND REPARSING ON SUPABASE (PRODUCTION)")
print("=" * 80)

supabase_conn, local_conn = get_db_connections()
supabase_cur = supabase_conn.cursor()

# Check current consolidated records
supabase_cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
current_count = supabase_cur.fetchone()[0]
print(f"\n📊 Current consolidated records in Supabase: {current_count}")

# Check raw records
supabase_cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE 'bog_gel_raw_%' 
    AND table_schema = 'public'
    ORDER BY table_name
""")
raw_tables = supabase_cur.fetchall()
print(f"📊 Found {len(raw_tables)} raw bank statement tables")

total_raw_records = 0
for table in raw_tables:
    table_name = table[0]
    supabase_cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = supabase_cur.fetchone()[0]
    print(f"  - {table_name}: {count} records")
    total_raw_records += count

print(f"\n📊 Total raw records to process: {total_raw_records}")

print("\n⚠️  WARNING: This will:")
print("    1. DELETE all records from consolidated_bank_accounts table in Supabase")
print("    2. Reprocess all raw bank statements with new payment_id logic")
print("    3. Take approximately 2-3 minutes for ~50k records")
print("\n⚠️  This affects PRODUCTION data in Supabase!")

response = input("\nAre you sure you want to continue? (yes/no): ")

if response.lower() != 'yes':
    print("❌ Cancelled")
    supabase_conn.close()
    local_conn.close()
    sys.exit(0)

# Truncate consolidated table
print("\n🗑️  Truncating consolidated_bank_accounts table in Supabase...")
supabase_cur.execute("TRUNCATE TABLE consolidated_bank_accounts CASCADE")
supabase_conn.commit()
print("✅ Consolidated table truncated")

# Verify
supabase_cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
after_truncate = supabase_cur.fetchone()[0]
print(f"✅ Verified: {after_truncate} records remaining")

print("\n🚀 Now run the backparse command:")
print("   python import_bank_xml_data.py backparse --clear")
print("\nNote: The script will automatically use Supabase for raw data and consolidated output")

supabase_conn.close()
local_conn.close()
