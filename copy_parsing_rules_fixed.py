import psycopg2

# Connection strings
local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def copy_parsing_rules():
    """Copy parsing_scheme_rules from local DB to Supabase"""
    
    # Connect to local DB
    print("🔌 Connecting to local DB...")
    local_conn = psycopg2.connect(local_conn_str)
    local_cur = local_conn.cursor()
    
    # Connect to Supabase
    print("🔌 Connecting to Supabase...")
    supabase_conn = psycopg2.connect(supabase_conn_str)
    supabase_cur = supabase_conn.cursor()
    
    try:
        # Add missing 'active' column to Supabase if needed
        print("\n📊 Checking Supabase schema...")
        supabase_cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'parsing_scheme_rules' AND column_name = 'active'
        """)
        has_active = supabase_cur.fetchone()
        
        if not has_active:
            print("➕ Adding 'active' column to Supabase parsing_scheme_rules...")
            supabase_cur.execute("""
                ALTER TABLE parsing_scheme_rules 
                ADD COLUMN active BOOLEAN DEFAULT TRUE
            """)
            supabase_conn.commit()
            print("✅ Column added")
        
        # Get count from local
        print("\n📊 Counting local parsing rules...")
        local_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        local_count = local_cur.fetchone()[0]
        print(f"   Found: {local_count} active rules")
        
        # Fetch all active rules from local
        print("\n📥 Fetching rules from local DB...")
        local_cur.execute("""
            SELECT id, scheme_uuid, column_name, condition, payment_id, 
                   condition_script, counteragent_uuid, financial_code_uuid, 
                   nominal_currency_uuid, active
            FROM parsing_scheme_rules
            WHERE active = TRUE
            ORDER BY id
        """)
        rules = local_cur.fetchall()
        print(f"   Fetched: {len(rules)} rules")
        
        # Show sample
        if rules:
            print("\n📄 Sample rule:")
            sample = rules[0]
            print(f"   ID: {sample[0]}")
            print(f"   Scheme UUID: {sample[1]}")
            print(f"   Column: {sample[2]}")
            print(f"   Condition: {sample[3]}")
            print(f"   Payment ID: {sample[4]}")
            print(f"   Counteragent UUID: {sample[6]}")
        
        # Clear existing rules from Supabase
        print("\n🗑️  Clearing Supabase parsing rules...")
        supabase_cur.execute("DELETE FROM parsing_scheme_rules")
        deleted = supabase_cur.rowcount
        print(f"   Deleted: {deleted} rules")
        
        # Insert rules to Supabase
        print("\n📤 Inserting rules to Supabase...")
        insert_query = """
            INSERT INTO parsing_scheme_rules 
            (id, scheme_uuid, column_name, condition, payment_id, condition_script,
             counteragent_uuid, financial_code_uuid, nominal_currency_uuid, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        supabase_cur.executemany(insert_query, rules)
        supabase_conn.commit()
        print(f"✅ Inserted: {len(rules)} rules")
        
        # Verify
        print("\n✅ Verifying...")
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        supabase_count = supabase_cur.fetchone()[0]
        print(f"   Local DB: {local_count}")
        print(f"   Supabase: {supabase_count}")
        
        if local_count == supabase_count:
            print("\n🎉 SUCCESS: All parsing rules copied!")
        else:
            print(f"\n⚠️  WARNING: Count mismatch!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        supabase_conn.rollback()
        raise
    finally:
        local_cur.close()
        local_conn.close()
        supabase_cur.close()
        supabase_conn.close()

if __name__ == "__main__":
    copy_parsing_rules()
