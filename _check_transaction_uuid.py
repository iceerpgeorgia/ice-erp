#!/usr/bin/env python3
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
from supabase import create_client, Client

url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
key = os.getenv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

if not url or not key:
    print("ERROR: Missing Supabase credentials in .env.local")
    exit(1)

supabase: Client = create_client(url, key)

uuid_target = "3ca0c418-67a3-58cb-a249-fab2df655909"

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
            print(f"\n=== TRANSACTION DETAILS ===")
            print(f"UUID: {row.get('uuid')}")
            print(f"Project UUID: {row.get('project_uuid')}")
            print(f"Payment ID: {row.get('payment_id')}")
            print(f"Financial Code UUID: {row.get('financial_code_uuid')}")
            print(f"Counteragent UUID: {row.get('counteragent_uuid')}")
            print(f"Counteragent Name: {row.get('counteragent_name')}")
            print(f"Transaction Date: {row.get('transaction_date')}")
            print(f"Description: {row.get('description')}")
            print(f"Account Currency Amount: {row.get('account_currency_amount')}")
            print(f"Nominal Amount: {row.get('nominal_amount')}")
            print(f"Source Table: {table}")
            
            payment_id = row.get('payment_id')
            project_uuid = row.get('project_uuid')
            financial_code_uuid = row.get('financial_code_uuid')
            
            print(f"\n=== VALIDATION ===")
            print(f"Has project_uuid: {bool(project_uuid)}")
            print(f"Has payment_id: {bool(payment_id)}")
            print(f"Has financial_code_uuid: {bool(financial_code_uuid)}")
            
            # Check if payment exists and its financial code
            if payment_id:
                print(f"\n=== CHECKING PAYMENT ===")
                try:
                    payments_result = supabase.table('payments').select(
                        'payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid, financial_codes(code, is_income)'
                    ).eq('payment_id', payment_id).execute()
                    
                    if payments_result.data:
                        payment = payments_result.data[0]
                        print(f"Payment found in payments table")
                        print(f"  Payment ID: {payment.get('payment_id')}")
                        print(f"  Counteragent UUID: {payment.get('counteragent_uuid')}")
                        print(f"  Project UUID: {payment.get('project_uuid')}")
                        print(f"  Financial Code UUID: {payment.get('financial_code_uuid')}")
                        print(f"  Currency UUID: {payment.get('currency_uuid')}")
                        
                        if payment.get('financial_codes'):
                            fc = payment['financial_codes']
                            print(f"\n  Financial Code Details:")
                            print(f"    Code: {fc.get('code')}")
                            print(f"    Is Income: {fc.get('is_income')}")
                        else:
                            print(f"  WARNING: Financial code not linked or is_income not found")
                    else:
                        print(f"Payment NOT found in payments table - this is the problem!")
                        print(f"Need to create or link this payment_id: {payment_id}")
                except Exception as e:
                    print(f"Error checking payment: {e}")
            else:
                print(f"No payment_id set - this is why it's not showing in handovers!")
            
            if financial_code_uuid:
                print(f"\n=== CHECKING FINANCIAL CODE ===")
                try:
                    fc_result = supabase.table('financial_codes').select('code, is_income').eq('uuid', financial_code_uuid).execute()
                    if fc_result.data:
                        fc = fc_result.data[0]
                        print(f"Financial Code: {fc.get('code')}")
                        print(f"Is Income: {fc.get('is_income')}")
                        if not fc.get('is_income'):
                            print(f"⚠ Financial code is NOT income - handovers only show income!")
                    else:
                        print(f"Financial code not found in database")
                except Exception as e:
                    print(f"Error checking financial code: {e}")
            
            found = True
            break
    except Exception as e:
        pass

if not found:
    print(f"\n✗ Transaction with UUID {uuid_target} not found in any table")
