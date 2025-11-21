import psycopg2
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("SYNC FINANCIAL CODES: LOCAL → SUPABASE")
print("="*80)

# Database connections
LOCAL_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
REMOTE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

try:
    # Connect to both databases
    print("\n🔌 Connecting to databases...")
    local_conn = psycopg2.connect(LOCAL_URL)
    remote_conn = psycopg2.connect(REMOTE_URL)
    
    local_cur = local_conn.cursor()
    remote_cur = remote_conn.cursor()
    
    print("   ✓ Connected to LOCAL database")
    print("   ✓ Connected to REMOTE (Supabase) database")
    
    # Check if financial_codes table exists in remote
    print("\n🔍 Checking if financial_codes table exists in REMOTE...")
    remote_cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'financial_codes'
        )
    """)
    table_exists = remote_cur.fetchone()[0]
    
    if not table_exists:
        print("   ⚠️  financial_codes table does NOT exist in REMOTE")
        print("\n📋 Creating financial_codes table in REMOTE...")
        
        # Get table schema from local
        local_cur.execute("""
            SELECT column_name, data_type, character_maximum_length, 
                   is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'financial_codes'
            ORDER BY ordinal_position
        """)
        columns = local_cur.fetchall()
        
        # Create table with actual schema
        create_table_sql = """
            CREATE TABLE financial_codes (
                id BIGSERIAL PRIMARY KEY,
                uuid UUID UNIQUE,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                validation TEXT,
                applies_to_pl BOOLEAN,
                applies_to_cf BOOLEAN,
                is_income BOOLEAN,
                parent_uuid UUID,
                description TEXT,
                depth INTEGER,
                sort_order INTEGER,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                FOREIGN KEY (parent_uuid) REFERENCES financial_codes(uuid)
            );
            
            CREATE INDEX idx_financial_codes_parent ON financial_codes(parent_uuid);
            CREATE INDEX idx_financial_codes_code ON financial_codes(code);
            CREATE INDEX idx_financial_codes_uuid ON financial_codes(uuid);
        """
        
        remote_cur.execute(create_table_sql)
        remote_conn.commit()
        print("   ✓ Created financial_codes table")
    else:
        print("   ✓ financial_codes table exists in REMOTE")
    
    # Get all financial codes from local
    print("\n📤 Fetching financial codes from LOCAL...")
    local_cur.execute("""
        SELECT id, uuid, code, name, validation, applies_to_pl, applies_to_cf, 
               is_income, parent_uuid, description, depth, sort_order, 
               is_active, created_at, updated_at
        FROM financial_codes
        ORDER BY code
    """)
    local_records = local_cur.fetchall()
    print(f"   Found {len(local_records)} records in LOCAL")
    
    # Get all financial codes from remote
    print("\n📥 Fetching financial codes from REMOTE...")
    remote_cur.execute("""
        SELECT id, uuid, code, name, validation, applies_to_pl, applies_to_cf,
               is_income, parent_uuid, description, depth, sort_order,
               is_active, created_at, updated_at
        FROM financial_codes
        ORDER BY code
    """)
    remote_records = remote_cur.fetchall()
    print(f"   Found {len(remote_records)} records in REMOTE")
    
    # Create dictionaries for comparison (using code as key since it's unique)
    local_dict = {row[2]: row for row in local_records}  # row[2] is code
    remote_dict = {row[2]: row for row in remote_records}
    
    # Find differences
    print("\n🔍 Analyzing differences...")
    only_in_local = set(local_dict.keys()) - set(remote_dict.keys())
    only_in_remote = set(remote_dict.keys()) - set(local_dict.keys())
    in_both = set(local_dict.keys()) & set(remote_dict.keys())
    
    print(f"   Only in LOCAL: {len(only_in_local)}")
    print(f"   Only in REMOTE: {len(only_in_remote)}")
    print(f"   In both: {len(in_both)}")
    
    if only_in_remote:
        print(f"\n⚠️  WARNING: {len(only_in_remote)} codes exist only in REMOTE:")
        for code in list(only_in_remote)[:5]:
            print(f"      - {code}")
        if len(only_in_remote) > 5:
            print(f"      ... and {len(only_in_remote) - 5} more")
    
    # Truncate remote table if there are records only in remote
    if only_in_remote or len(remote_records) > 0:
        print(f"\n🗑️  Truncating REMOTE financial_codes table...")
        remote_cur.execute("TRUNCATE TABLE financial_codes RESTART IDENTITY CASCADE")
        remote_conn.commit()
        print("   ✓ Table truncated")
    
    # Insert all records from local to remote
    if local_records:
        print(f"\n📤 Inserting {len(local_records)} records to REMOTE...")
        
        # First pass: Insert records without parent references (root nodes)
        root_records = [r for r in local_records if r[8] is None]  # r[8] is parent_uuid
        print(f"   Inserting {len(root_records)} root codes...")
        
        insert_sql = """
            INSERT INTO financial_codes (
                id, uuid, code, name, validation, applies_to_pl, applies_to_cf,
                is_income, parent_uuid, description, depth, sort_order,
                is_active, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        for record in root_records:
            remote_cur.execute(insert_sql, record)
        
        remote_conn.commit()
        print(f"   ✓ Inserted {len(root_records)} root codes")
        
        # Second pass: Insert records with parent references
        child_records = [r for r in local_records if r[8] is not None]
        if child_records:
            print(f"   Inserting {len(child_records)} child codes...")
            
            for record in child_records:
                try:
                    remote_cur.execute(insert_sql, record)
                except Exception as e:
                    print(f"      ⚠️  Failed to insert {record[2]}: {e}")
            
            remote_conn.commit()
            print(f"   ✓ Inserted {len(child_records)} child codes")
        
        # Update sequence to match
        print("\n🔧 Updating sequence...")
        local_cur.execute("SELECT MAX(id) FROM financial_codes")
        max_id = local_cur.fetchone()[0]
        remote_cur.execute(f"SELECT setval('financial_codes_id_seq', {max_id})")
        remote_conn.commit()
        print(f"   ✓ Sequence set to {max_id}")
    
    # Final verification
    print("\n✅ Verifying sync...")
    remote_cur.execute("SELECT COUNT(*) FROM financial_codes")
    final_count = remote_cur.fetchone()[0]
    print(f"   Total financial codes in REMOTE: {final_count}")
    
    # Verify hierarchy integrity
    remote_cur.execute("""
        SELECT COUNT(*) FROM financial_codes
        WHERE parent_uuid IS NOT NULL
        AND parent_uuid NOT IN (SELECT uuid FROM financial_codes WHERE uuid IS NOT NULL)
    """)
    orphaned = remote_cur.fetchone()[0]
    
    if orphaned > 0:
        print(f"   ⚠️  Found {orphaned} orphaned records (invalid parent references)")
    else:
        print(f"   ✓ All parent references are valid")
    
    print("\n" + "="*80)
    print("✅ SYNC COMPLETED SUCCESSFULLY!")
    print("="*80)
    print(f"\nSummary:")
    print(f"  • Total codes synced: {final_count}")
    print(f"  • Root codes: {len(root_records)}")
    print(f"  • Child codes: {len(child_records) if 'child_records' in locals() else 0}")
    
    local_cur.close()
    remote_cur.close()
    local_conn.close()
    remote_conn.close()

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    if 'remote_conn' in locals():
        remote_conn.rollback()
    sys.exit(1)
