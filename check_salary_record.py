import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

uuid = '3d946a71-8857-4afa-b8c0-1562c3f13bda'

# Connect to LOCAL database
local_url = os.getenv('DATABASE_URL')
local_conn = psycopg2.connect(local_url)
local_cur = local_conn.cursor()

# Get the raw record from Supabase (since that's where raw data is)
supabase_url = os.getenv('DIRECT_URL')
supabase_conn = psycopg2.connect(supabase_url)
supabase_cur = supabase_conn.cursor()

print("\n" + "="*80)
print("RAW RECORD (Supabase)")
print("="*80)

supabase_cur.execute(f"""
    SELECT dockey, entriesid, docinformation, docprodgroup,
           docsenderinn, docbenefinn,
           counteragent_processed, payment_id_processed
    FROM bog_gel_raw_893486000
    WHERE uuid = '{uuid}'
""")

raw = supabase_cur.fetchone()
if raw:
    print(f"DocKey: {raw[0]}")
    print(f"EntriesId: {raw[1]}")
    print(f"DocInformation: {raw[2]}")
    print(f"DocProdGroup: {raw[3]}")
    print(f"DocSenderInn: {raw[4]}")
    print(f"DocBenefInn: {raw[5]}")
    print(f"counteragent_processed: {raw[6]}")
    print(f"payment_id_processed: {raw[7]}")
    
    doc_key = raw[0]
    entries_id = raw[1]
    doc_info = raw[2]
    
    print("\n" + "="*80)
    print("CONSOLIDATED RECORD (Local)")
    print("="*80)
    
    local_cur.execute(f"""
        SELECT payment_id, counteragent_uuid, project_uuid, 
               financial_code_uuid, nominal_currency_uuid
        FROM consolidated_bank_accounts
        WHERE dockey = '{doc_key}' AND entriesid = '{entries_id}'
    """)
    
    cons = local_cur.fetchone()
    if cons:
        print(f"payment_id: {cons[0]}")
        print(f"counteragent_uuid: {cons[1]}")
        print(f"project_uuid: {cons[2]}")
        print(f"financial_code_uuid: {cons[3]}")
        print(f"nominal_currency_uuid: {cons[4]}")
        
        if cons[0]:
            print("\n" + "="*80)
            print("CHECKING SALARY_ACCRUALS MATCH")
            print("="*80)
            
            # Check exact match
            local_cur.execute(f"""
                SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
                FROM salary_accruals
                WHERE payment_id = '{cons[0]}'
            """)
            
            salary = local_cur.fetchone()
            if salary:
                print("✅ EXACT MATCH FOUND:")
                print(f"  Salary ID: {salary[0]}")
                print(f"  Payment ID: {salary[1]}")
                print(f"  Net Sum: {salary[2]}")
                print(f"  Month: {salary[3]}")
            else:
                print(f"❌ No exact match for payment_id: {cons[0]}")
                
                # Try case-insensitive
                local_cur.execute(f"""
                    SELECT id, payment_id, counteragent_uuid, net_sum, salary_month
                    FROM salary_accruals
                    WHERE LOWER(payment_id) = LOWER('{cons[0]}')
                """)
                
                salary_ci = local_cur.fetchone()
                if salary_ci:
                    print("✅ CASE-INSENSITIVE MATCH:")
                    print(f"  Salary ID: {salary_ci[0]}")
                    print(f"  Payment ID: {salary_ci[1]}")
                    print(f"  Consolidated has: {cons[0]}")
                else:
                    print("❌ No case-insensitive match either")
                    
                    # Check if doc_info matches salary pattern
                    if doc_info and 'NP_' in doc_info.upper():
                        print(f"\n⚠️  DocInformation contains salary pattern: {doc_info}")
                        print("   But it wasn't extracted to consolidated.payment_id!")
        else:
            print("\n⚠️  payment_id is NULL in consolidated table")
            print(f"   But DocInformation has: {doc_info}")
    else:
        print("❌ No consolidated record found")
else:
    print("❌ Raw record not found")

supabase_conn.close()
local_conn.close()
