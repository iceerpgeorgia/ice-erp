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
    
    print("=" * 70)
    print("CHECKING SUPABASE DATA RELATIONSHIPS")
    print("=" * 70)
    
    # Check payments with jobs
    cur.execute("""
        SELECT 
            COUNT(*) as total_payments,
            COUNT(job_uuid) as payments_with_jobs
        FROM payments
        WHERE is_active = true
    """)
    payment_stats = cur.fetchone()
    print(f"\nPayments:")
    print(f"  Total active: {payment_stats['total_payments']}")
    print(f"  With jobs: {payment_stats['payments_with_jobs']}")
    
    # Check jobs
    cur.execute("SELECT COUNT(*) as total FROM jobs WHERE is_active = true")
    job_count = cur.fetchone()['total']
    print(f"\nJobs:")
    print(f"  Total active: {job_count}")
    
    # Check bank transactions
    cur.execute("""
        SELECT 
            COUNT(*) as total_transactions,
            COUNT(payment_uuid) as transactions_with_payments,
            COUNT(counteragent_uuid) as transactions_with_counteragents
        FROM consolidated_bank_accounts
    """)
    trans_stats = cur.fetchone()
    print(f"\nBank Transactions:")
    print(f"  Total: {trans_stats['total_transactions']}")
    print(f"  With payment: {trans_stats['transactions_with_payments']}")
    print(f"  With counteragent: {trans_stats['transactions_with_counteragents']}")
    
    # Find sample payment with job
    print("\n" + "=" * 70)
    print("SAMPLE: Payment with Job")
    print("=" * 70)
    
    cur.execute("""
        SELECT 
            p.payment_id,
            p.counteragent_uuid,
            p.job_uuid,
            j.job_name,
            pr.project_name,
            c.code as currency_code,
            fc.validation as financial_code
        FROM payments p
        LEFT JOIN jobs j ON p.job_uuid = j.job_uuid
        LEFT JOIN projects pr ON p.project_uuid = pr.project_uuid
        LEFT JOIN currencies c ON p.currency_uuid = c.uuid
        LEFT JOIN financial_codes fc ON p.financial_code_uuid = fc.uuid
        WHERE p.is_active = true 
        AND p.job_uuid IS NOT NULL
        LIMIT 3
    """)
    
    sample_payments = cur.fetchall()
    for i, pmt in enumerate(sample_payments, 1):
        print(f"\nPayment {i}:")
        print(f"  ID: {pmt['payment_id']}")
        print(f"  Job: {pmt['job_name']}")
        print(f"  Project: {pmt['project_name']}")
        print(f"  Currency: {pmt['currency_code']}")
        print(f"  Financial Code: {pmt['financial_code']}")
        print(f"  Counteragent UUID: {pmt['counteragent_uuid'][:20]}...")
        
        # Check if this counteragent has transactions
        cur.execute("""
            SELECT COUNT(*) as count
            FROM consolidated_bank_accounts
            WHERE counteragent_uuid = %s
        """, (pmt['counteragent_uuid'],))
        trans_count = cur.fetchone()['count']
        print(f"  Bank Transactions for this counteragent: {trans_count}")
    
    cur.close()
    conn.close()
    print("\n" + "=" * 70)

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
