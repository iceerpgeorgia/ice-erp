import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

uuid = '3d946a71-8857-4afa-b8c0-1562c3f13bda'

# Connect to Supabase to check raw data
supabase_conn = psycopg2.connect(os.getenv('DIRECT_URL'))
supabase_cur = supabase_conn.cursor()

print(f"\n{'='*80}")
print(f"Checking Raw Record: {uuid}")
print(f"{'='*80}\n")

supabase_cur.execute("""
    SELECT uuid, dockey, entriesid, docsenderinn, docbenefinn, docprodgroup, 
           counteragent_processed, parsing_rule_processed, payment_id_processed,
           docinformation
    FROM bog_gel_raw_893486000
    WHERE uuid = %s
""", (uuid,))

raw = supabase_cur.fetchone()
if raw:
    print("📋 Raw Record in Supabase:")
    print(f"  UUID: {raw[0]}")
    print(f"  DocKey: {raw[1]}")
    print(f"  EntriesId: {raw[2]}")
    print(f"  DocSenderInn: {raw[3]}")
    print(f"  DocBenefInn: {raw[4]}")
    print(f"  DocProdGroup: {raw[5]}")
    print(f"  DocInformation: {raw[9]}")
    print(f"\n🚦 Processing Flags:")
    print(f"  counteragent_processed: {raw[6]}")
    print(f"  parsing_rule_processed: {raw[7]}")
    print(f"  payment_id_processed: {raw[8]}")
    
    # Check consolidated table
    local_conn = psycopg2.connect(os.getenv('DATABASE_URL').split('?')[0])
    local_cur = local_conn.cursor()
    
    local_cur.execute("""
        SELECT payment_id, counteragent_uuid
        FROM consolidated_bank_accounts
        WHERE dockey = %s AND entriesid = %s
    """, (raw[1], raw[2]))
    
    cons = local_cur.fetchone()
    if cons:
        print(f"\n📊 Consolidated Record (Local):")
        print(f"  payment_id: {cons[0]}")
        print(f"  counteragent_uuid: {cons[1]}")
        
        if cons[0]:
            print(f"\n✅ Payment ID WAS extracted and stored!")
            print(f"  So payment_id_processed should be TRUE")
        else:
            print(f"\n⚠️  Payment ID is NULL in consolidated table")
    else:
        print(f"\n❌ No consolidated record found")
    
    local_conn.close()
else:
    print("❌ Raw record not found in Supabase")

supabase_conn.close()
