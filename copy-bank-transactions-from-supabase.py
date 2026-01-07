#!/usr/bin/env python3
"""
Copy consolidated_bank_accounts (bank transactions) data from Supabase to local database.
"""

import os
import psycopg2
from psycopg2.extras import execute_batch

# Load environment variables directly from .env file
def load_env_vars():
    """Load environment variables from .env and .env.local files."""
    env_vars = {}
    
    # Try .env first
    for env_file in ['.env', '.env.local']:
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_vars[key.strip()] = value.strip().strip('"').strip("'")
        except Exception as e:
            print(f"Warning: Could not load {env_file}: {e}")
    return env_vars

env_vars = load_env_vars()

# Database connections
SUPABASE_URL = (env_vars.get('SUPABASE_DATABASE_URL') or 
                env_vars.get('REMOTE_DATABASE_URL') or 
                os.getenv('SUPABASE_DATABASE_URL') or
                os.getenv('REMOTE_DATABASE_URL'))
LOCAL_URL = env_vars.get('DATABASE_URL') or os.getenv('DATABASE_URL')

if not SUPABASE_URL or not LOCAL_URL:
    print("Error: Missing database URLs in environment variables")
    print("Please ensure SUPABASE_DATABASE_URL and DATABASE_URL are set in .env file")
    exit(1)

# Clean up Supabase URL (remove pgbouncer parameters that psycopg2 doesn't support)
if 'pgbouncer' in SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.split('?')[0]
    print("Note: Removed pgbouncer parameters from Supabase URL")

# Clean up Local URL (remove schema parameter that psycopg2 doesn't support)
if 'schema=' in LOCAL_URL:
    LOCAL_URL = LOCAL_URL.split('?')[0]
    print("Note: Removed schema parameter from Local URL")

print(f"Local DB: {LOCAL_URL[:30]}...")
print(f"Supabase DB: {SUPABASE_URL[:40]}...")

def copy_bank_transactions():
    """Copy consolidated_bank_accounts from Supabase to local."""
    
    print("Connecting to databases...")
    supabase_conn = psycopg2.connect(SUPABASE_URL)
    local_conn = psycopg2.connect(LOCAL_URL)
    
    supabase_cur = supabase_conn.cursor()
    local_cur = local_conn.cursor()
    
    try:
        # Fetch all records from Supabase
        print("Fetching bank transactions from Supabase...")
        supabase_cur.execute("""
            SELECT 
                id, uuid, account_uuid, account_currency_uuid, 
                account_currency_amount, payment_uuid, counteragent_uuid,
                project_uuid, financial_code_uuid, nominal_currency_uuid,
                nominal_amount, date, correction_date, id_1, id_2,
                record_uuid, counteragent_account_number, description,
                created_at, updated_at
            FROM consolidated_bank_accounts
            ORDER BY id
        """)
        
        records = supabase_cur.fetchall()
        print(f"Found {len(records)} bank transaction records in Supabase")
        
        if not records:
            print("No records to copy")
            return
        
        # Clear existing records in local (optional - comment out if you want to keep existing)
        print("Clearing existing local bank transactions...")
        local_cur.execute("TRUNCATE TABLE consolidated_bank_accounts CASCADE")
        
        # Insert records into local database
        print("Inserting records into local database...")
        insert_query = """
            INSERT INTO consolidated_bank_accounts (
                id, uuid, account_uuid, account_currency_uuid,
                account_currency_amount, payment_uuid, counteragent_uuid,
                project_uuid, financial_code_uuid, nominal_currency_uuid,
                nominal_amount, date, correction_date, id_1, id_2,
                record_uuid, counteragent_account_number, description,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
        """
        
        execute_batch(local_cur, insert_query, records, page_size=100)
        
        # Reset sequence for id column
        print("Resetting sequence...")
        local_cur.execute("""
            SELECT setval('consolidated_bank_accounts_id_seq', 
                         (SELECT MAX(id) FROM consolidated_bank_accounts));
        """)
        
        local_conn.commit()
        print(f"✓ Successfully copied {len(records)} bank transaction records to local database")
        
        # Verify count
        local_cur.execute("SELECT COUNT(*) FROM consolidated_bank_accounts")
        local_count = local_cur.fetchone()[0]
        print(f"✓ Verified: {local_count} records in local database")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        local_conn.rollback()
        raise
    finally:
        supabase_cur.close()
        local_cur.close()
        supabase_conn.close()
        local_conn.close()

if __name__ == '__main__':
    copy_bank_transactions()
