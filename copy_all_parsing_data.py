import psycopg2

# Connection strings
local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def copy_parsing_data():
    """Copy parsing_schemes and parsing_scheme_rules from local DB to Supabase"""
    
    # Connect to local DB
    print("🔌 Connecting to local DB...")
    local_conn = psycopg2.connect(local_conn_str)
    local_cur = local_conn.cursor()
    
    # Connect to Supabase
    print("🔌 Connecting to Supabase...")
    supabase_conn = psycopg2.connect(supabase_conn_str)
    supabase_cur = supabase_conn.cursor()
    
    try:
        # ====== STEP 1: Copy parsing_schemes ======
        print("\n" + "="*60)
        print("STEP 1: COPYING PARSING_SCHEMES")
        print("="*60)
        
        # Get parsing_schemes schema from local
        local_cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'parsing_schemes' 
            ORDER BY ordinal_position
        """)
        local_scheme_cols = local_cur.fetchall()
        print(f"\n📊 Local parsing_schemes columns ({len(local_scheme_cols)}):")
        for col, dtype in local_scheme_cols:
            print(f"   - {col}: {dtype}")
        
        # Get parsing_schemes from local
        local_cur.execute("SELECT COUNT(*) FROM parsing_schemes")
        local_schemes_count = local_cur.fetchone()[0]
        print(f"\n📊 Local parsing_schemes count: {local_schemes_count}")
        
        # Fetch all schemes
        local_cur.execute("""
            SELECT uuid, name, account_uuid, description, created_at, updated_at
            FROM parsing_schemes
            ORDER BY uuid
        """)
        schemes = local_cur.fetchall()
        print(f"   Fetched: {len(schemes)} schemes")
        
        if schemes:
            print("\n📄 Sample scheme:")
            sample = schemes[0]
            print(f"   UUID: {sample[0]}")
            print(f"   Name: {sample[1]}")
            print(f"   Account UUID: {sample[2]}")
            print(f"   Description: {sample[3]}")
        
        # Clear and insert to Supabase
        print("\n🗑️  Clearing Supabase parsing_schemes...")
        supabase_cur.execute("DELETE FROM parsing_schemes")
        deleted = supabase_cur.rowcount
        print(f"   Deleted: {deleted} schemes")
        
        print("\n📤 Inserting schemes to Supabase...")
        insert_scheme_query = """
            INSERT INTO parsing_schemes 
            (uuid, name, account_uuid, description, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        supabase_cur.executemany(insert_scheme_query, schemes)
        supabase_conn.commit()
        print(f"✅ Inserted: {len(schemes)} schemes")
        
        # ====== STEP 2: Copy parsing_scheme_rules ======
        print("\n" + "="*60)
        print("STEP 2: COPYING PARSING_SCHEME_RULES")
        print("="*60)
        
        # Check for 'active' column on Supabase
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
        else:
            print("✅ 'active' column already exists")
        
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
            print(f"   Active: {sample[9]}")
        
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
        
        # ====== VERIFICATION ======
        print("\n" + "="*60)
        print("VERIFICATION")
        print("="*60)
        
        # Verify schemes
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_schemes")
        supabase_schemes_count = supabase_cur.fetchone()[0]
        print(f"\n📊 Parsing Schemes:")
        print(f"   Local DB: {local_schemes_count}")
        print(f"   Supabase: {supabase_schemes_count}")
        if local_schemes_count == supabase_schemes_count:
            print("   ✅ MATCH")
        else:
            print("   ⚠️  MISMATCH")
        
        # Verify rules
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        supabase_count = supabase_cur.fetchone()[0]
        print(f"\n📊 Parsing Rules (active):")
        print(f"   Local DB: {local_count}")
        print(f"   Supabase: {supabase_count}")
        if local_count == supabase_count:
            print("   ✅ MATCH")
        else:
            print("   ⚠️  MISMATCH")
        
        if local_schemes_count == supabase_schemes_count and local_count == supabase_count:
            print("\n🎉 SUCCESS: All parsing data copied!")
            print("\n📝 Next steps:")
            print("   1. Re-run backparse to apply parsing rules")
            print("   2. Decide if 'active' column needs UI toggle")
        else:
            print(f"\n⚠️  WARNING: Count mismatch!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        supabase_conn.rollback()
        raise
    finally:
        local_cur.close()
        local_conn.close()
        supabase_cur.close()
        supabase_conn.close()

if __name__ == "__main__":
    copy_parsing_data()
