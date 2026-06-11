import os
import json
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Initialize Supabase client
url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not url or not key:
    print("ERROR: Missing Supabase credentials in .env.local")
    exit(1)

supabase: Client = create_client(url, key)

# Query the transaction by UUID
uuid_target = "3ca0c418-67a3-58cb-a249-fab2df655909"

# First, find which table contains this UUID
tables = [
    "GE78BG0000000893486000_BOG_GEL",
    "GE74BG0000000586388146_BOG_USD",
    "GE78BG0000000893486000_BOG_USD",
    "GE78BG0000000893486000_BOG_EUR",
    "GE78BG0000000893486000_BOG_AED",
    "GE78BG0000000893486000_BOG_GBP",
    "GE78BG0000000893486000_BOG_KZT",
    "GE78BG0000000893486000_BOG_CNY",
    "GE78BG0000000893486000_BOG_TRY",
    "GE65TB7856036050100002_TBC_GEL",
    "GE39TB7856036150100001_TBC_USD",
    "GE39TB7856036150100001_TBC_EUR",
    "GE79TB7856045067800004_TBC_GEL",
    "GE52TB7856045067800005_TBC_GEL",
]

found = False
for table in tables:
    try:
        result = supabase.table(table).select("*").eq("uuid", uuid_target).execute()
        if result.data:
            print(f"\n✓ Transaction found in table: {table}")
            row = result.data[0]
            print(f"\nTransaction Details:")
            print(f"  UUID: {row.get('uuid')}")
            print(f"  Project UUID: {row.get('project_uuid')}")
            print(f"  Payment ID: {row.get('payment_id')}")
            print(f"  Financial Code UUID: {row.get('financial_code_uuid')}")
            print(f"  Counteragent UUID: {row.get('counteragent_uuid')}")
            print(f"  Transaction Date: {row.get('transaction_date')}")
            print(f"  Description: {row.get('description')}")
            print(f"  Account Currency Amount: {row.get('account_currency_amount')}")
            print(f"  Nominal Amount: {row.get('nominal_amount')}")
            print(f"  Source Table: {table}")
            
            # Now check if this payment has an income financial code
            if row.get('payment_id'):
                print(f"\nChecking payment: {row.get('payment_id')}")
                payments_result = supabase.table('payments').select('*, financial_codes(code, is_income)').eq('payment_id', row.get('payment_id')).execute()
                if payments_result.data:
                    payment = payments_result.data[0]
                    print(f"  Payment found")
                    print(f"  Financial Code UUID: {payment.get('financial_code_uuid')}")
                    if payment.get('financial_codes'):
                        print(f"  Financial Code: {payment['financial_codes'].get('code')}")
                        print(f"  Is Income: {payment['financial_codes'].get('is_income')}")
                else:
                    print(f"  ⚠ Payment NOT found in payments table")
            
            found = True
            break
    except Exception as e:
        print(f"Error checking table {table}: {e}")

if not found:
    print(f"\n✗ Transaction with UUID {uuid_target} not found in any table")
