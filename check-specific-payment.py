import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

remote_url = os.getenv('REMOTE_DATABASE_URL')
if not remote_url:
    print("❌ REMOTE_DATABASE_URL not found")
    exit(1)

if '?pgbouncer=' in remote_url:
    remote_url = remote_url.split('?')[0]

try:
    conn = psycopg2.connect(remote_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    print("=" * 80)
    print("CHECKING SPECIFIC PAYMENT: a6042a_48_b0e8b1")
    print("=" * 80)
    
    # Check the specific payment
    cur.execute("""
        SELECT 
            p.id,
            p.payment_id,
            p.project_uuid,
            p.counteragent_uuid,
            p.financial_code_uuid,
            p.job_uuid,
            p.currency_uuid,
            p.income_tax,
            p.is_active,
            j.job_name,
            pr.project_name,
            c.code as currency_code,
            fc.validation as financial_code,
            ca.name as counteragent_name
        FROM payments p
        LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
        LEFT JOIN projects pr ON p.project_uuid = pr.project_uuid
        LEFT JOIN currencies c ON p.currency_uuid = c.uuid
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        LEFT JOIN counteragents ca ON p.counteragent_uuid = ca.counteragent_uuid
        WHERE p.payment_id = 'a6042a_48_b0e8b1'
    """)
    
    payment = cur.fetchone()
    
    if payment:
        print(f"\n✅ Payment Found!")
        print(f"  Database ID: {payment['id']}")
        print(f"  Payment ID: {payment['payment_id']}")
        print(f"  Job UUID: {payment['job_uuid']}")
        print(f"  Job Name: {payment['job_name'] or 'NO JOB'}")
        print(f"  Project: {payment['project_name']}")
        print(f"  Currency: {payment['currency_code']}")
        print(f"  Financial Code: {payment['financial_code']}")
        print(f"  Counteragent: {payment['counteragent_name']}")
        print(f"  Counteragent UUID: {payment['counteragent_uuid']}")
        print(f"  Is Active: {payment['is_active']}")
        
        # Now check bank transaction with ID 984
        print("\n" + "=" * 80)
        print("CHECKING BANK TRANSACTION ID: 984")
        print("=" * 80)
        
        cur.execute("""
            SELECT 
                id,
                uuid,
                account_uuid,
                payment_uuid,
                counteragent_uuid,
                project_uuid,
                financial_code_uuid,
                nominal_currency_uuid,
                account_currency_amount,
                nominal_amount,
                date,
                description
            FROM consolidated_bank_accounts
            WHERE id = 984
        """)
        
        transaction = cur.fetchone()
        
        if transaction:
            print(f"\n✅ Bank Transaction Found!")
            print(f"  ID: {transaction['id']}")
            print(f"  UUID: {transaction['uuid']}")
            print(f"  Payment UUID: {transaction['payment_uuid'] or 'NO PAYMENT'}")
            print(f"  Counteragent UUID: {transaction['counteragent_uuid'] or 'NO COUNTERAGENT'}")
            print(f"  Project UUID: {transaction['project_uuid'] or 'NO PROJECT'}")
            print(f"  Date: {transaction['date']}")
            print(f"  Amount: {transaction['account_currency_amount']}")
            print(f"  Description: {transaction['description'][:100] if transaction['description'] else 'N/A'}")
            
            # Check if counteragent matches
            if transaction['counteragent_uuid'] and transaction['counteragent_uuid'] == payment['counteragent_uuid']:
                print(f"\n✅ Counteragent MATCHES between payment and transaction!")
            else:
                print(f"\n⚠️  Counteragent DOES NOT match")
                print(f"     Payment counteragent: {payment['counteragent_uuid']}")
                print(f"     Transaction counteragent: {transaction['counteragent_uuid']}")
            
            # Now test what the API would return for this transaction
            print("\n" + "=" * 80)
            print("SIMULATING API CALL FOR TRANSACTION 984")
            print("=" * 80)
            
            if transaction['counteragent_uuid']:
                cur.execute("""
                    SELECT 
                        p.payment_id,
                        p.project_uuid,
                        p.financial_code_uuid,
                        p.currency_uuid,
                        p.job_uuid,
                        j.job_name,
                        pr.project_name,
                        c.code as currency_code,
                        fc.validation as financial_code_validation
                    FROM payments p
                    LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
                    LEFT JOIN projects pr ON p.project_uuid = pr.project_uuid
                    LEFT JOIN currencies c ON p.currency_uuid = c.uuid
                    LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
                    WHERE p.counteragent_uuid = %s
                    AND p.is_active = true
                    ORDER BY p.payment_id
                """, (transaction['counteragent_uuid'],))
                
                api_payments = cur.fetchall()
                
                print(f"\nFound {len(api_payments)} payment(s) for this transaction's counteragent:\n")
                
                for i, pmt in enumerate(api_payments, 1):
                    print(f"Payment {i}:")
                    print(f"  Payment ID: {pmt['payment_id']}")
                    print(f"  Job Name: {pmt['job_name'] or '(none)'}")
                    print(f"  Currency: {pmt['currency_code']}")
                    print(f"  Project: {pmt['project_name']}")
                    print(f"  Financial Code: {pmt['financial_code_validation']}")
                    
                    # Show what would appear in the selector
                    display = f"{pmt['payment_id']}"
                    if pmt['currency_code'] or pmt['project_name'] or pmt['job_name'] or pmt['financial_code_validation']:
                        display += f" | {pmt['currency_code'] or '-'}"
                        display += f" | {pmt['project_name'] or '-'}"
                        if pmt['job_name']:
                            display += f" | {pmt['job_name']}"
                        display += f" | {pmt['financial_code_validation'] or '-'}"
                    
                    print(f"  Display in selector: {display}")
                    print()
            else:
                print("\n⚠️  Transaction has no counteragent UUID - cannot fetch payment options")
        else:
            print("\n❌ Bank Transaction 984 NOT FOUND")
    else:
        print("\n❌ Payment 'a6042a_48_b0e8b1' NOT FOUND")
    
    cur.close()
    conn.close()
    print("=" * 80)

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
