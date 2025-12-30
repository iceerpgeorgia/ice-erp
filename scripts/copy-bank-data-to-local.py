"""
Copy bank transactions and raw bank data from Supabase to local PostgreSQL
"""
import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

# Load environment variables
load_dotenv()

# Get database URLs
SUPABASE_DB = os.getenv('DATABASE_URL')
if SUPABASE_DB and '?schema=' in SUPABASE_DB:
    # Remove schema parameter for psycopg2
    SUPABASE_DB = SUPABASE_DB.split('?schema=')[0]
LOCAL_DB = 'postgresql://postgres:admin@localhost:5432/ice_erp'

def get_supabase_connection():
    """Connect to Supabase PostgreSQL"""
    return psycopg2.connect(SUPABASE_DB)

def get_local_connection():
    """Connect to local PostgreSQL"""
    return psycopg2.connect(LOCAL_DB)

def copy_table_data(supabase_conn, local_conn, table_name, order_by='id'):
    """Copy data from Supabase table to local table"""
    print(f"\n📋 Copying {table_name}...")
    
    with supabase_conn.cursor() as supabase_cur:
        # Get data from Supabase
        supabase_cur.execute(f"SELECT * FROM {table_name} ORDER BY {order_by}")
        rows = supabase_cur.fetchall()
        
        if not rows:
            print(f"   ⚠️  No data found in {table_name}")
            return
        
        # Get column names
        columns = [desc[0] for desc in supabase_cur.description]
        
        print(f"   Found {len(rows)} rows")
        
        with local_conn.cursor() as local_cur:
            # Clear existing data (optional - comment out if you want to keep existing data)
            print(f"   🗑️  Clearing existing data in local {table_name}...")
            local_cur.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE")
            
            # Insert data
            print(f"   📝 Inserting {len(rows)} rows...")
            cols = ', '.join(columns)
            placeholders = ', '.join(['%s'] * len(columns))
            insert_query = f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"
            
            # Insert in batches
            batch_size = 1000
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                for row in batch:
                    local_cur.execute(insert_query, row)
                local_conn.commit()
                print(f"   ✓ Inserted {min(i + batch_size, len(rows))}/{len(rows)} rows")
            
            print(f"   ✅ Successfully copied {table_name}")

def main():
    print("🚀 Starting bank data copy from Supabase to local...")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    try:
        # Connect to databases
        print("🔌 Connecting to Supabase...")
        supabase_conn = get_supabase_connection()
        print("✓ Connected to Supabase")
        
        print("🔌 Connecting to local database...")
        local_conn = get_local_connection()
        print("✓ Connected to local database\n")
        
        # Copy banks table first (referenced by bank_accounts)
        copy_table_data(supabase_conn, local_conn, 'banks', 'id')
        
        # Copy bank_accounts table
        copy_table_data(supabase_conn, local_conn, 'bank_accounts', 'id')
        
        # Copy consolidated_bank_accounts table
        copy_table_data(supabase_conn, local_conn, 'consolidated_bank_accounts', 'id')
        
        # Check for raw bank transaction tables
        with supabase_conn.cursor() as cur:
            cur.execute("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename LIKE '%raw%bank%'
                OR tablename LIKE '%bog%'
                ORDER BY tablename
            """)
            raw_tables = cur.fetchall()
            
            if raw_tables:
                print(f"\n📦 Found {len(raw_tables)} raw bank data tables:")
                for (table,) in raw_tables:
                    print(f"   - {table}")
                    copy_table_data(supabase_conn, local_conn, table, 'id')
        
        print("\n" + "="*60)
        print("✅ All bank data copied successfully!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    
    finally:
        if 'supabase_conn' in locals():
            supabase_conn.close()
            print("\n🔌 Closed Supabase connection")
        if 'local_conn' in locals():
            local_conn.close()
            print("🔌 Closed local connection")

if __name__ == '__main__':
    main()
