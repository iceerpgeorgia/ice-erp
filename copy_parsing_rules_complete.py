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
        # Get count from local
        print("\n📊 Counting local parsing rules...")
        local_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        local_active = local_cur.fetchone()[0]
        local_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = FALSE")
        local_inactive = local_cur.fetchone()[0]
        local_total = local_active + local_inactive
        print(f"   Total: {local_total}")
        print(f"   Active: {local_active}")
        print(f"   Inactive: {local_inactive}")
        
        # Fetch ALL rules from local (including inactive)
        print(f"\n📥 Fetching ALL rules from local DB...")
        local_cur.execute("""
            SELECT id, scheme_uuid, column_name, condition, payment_id, 
                   condition_script, counteragent_uuid, financial_code_uuid, 
                   nominal_currency_uuid, active
            FROM parsing_scheme_rules
            ORDER BY id
        """)
        rules = local_cur.fetchall()
        print(f"   Fetched: {len(rules)} rules")
        
        # Show sample
        if rules:
            print("\n📄 Sample rules:")
            for i in range(min(3, len(rules))):
                sample = rules[i]
                print(f"\n   Rule #{i+1}:")
                print(f"     ID: {sample[0]}")
                print(f"     Scheme UUID: {sample[1]}")
                print(f"     Condition: {sample[3]}")
                print(f"     Active: {sample[9]}")
        
        # Clear existing rules from Supabase
        print(f"\n🗑️  Clearing Supabase parsing rules...")
        supabase_cur.execute("DELETE FROM parsing_scheme_rules")
        deleted = supabase_cur.rowcount
        print(f"   Deleted: {deleted} rules")
        
        # Insert rules to Supabase
        print(f"\n📤 Inserting {len(rules)} rules to Supabase...")
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
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules")
        supabase_total = supabase_cur.fetchone()[0]
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        supabase_active = supabase_cur.fetchone()[0]
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = FALSE")
        supabase_inactive = supabase_cur.fetchone()[0]
        
        print(f"\n📊 Comparison:")
        print(f"   {'':20} Local    Supabase")
        print(f"   {'-'*40}")
        print(f"   {'Total:':<20} {local_total:<8} {supabase_total}")
        print(f"   {'Active:':<20} {local_active:<8} {supabase_active}")
        print(f"   {'Inactive:':<20} {local_inactive:<8} {supabase_inactive}")
        
        if local_total == supabase_total and local_active == supabase_active:
            print("\n🎉 SUCCESS: All parsing rules copied!")
            print("\n📝 Next steps:")
            print("   1. Re-run backparse to apply parsing rules to consolidated data")
            print(f"   2. Decision needed: Keep 'active' column with UI toggle?")
            print(f"      - Currently {supabase_inactive} inactive rules on Supabase")
            print(f"      - Active column allows enabling/disabling rules without deleting")
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
    copy_parsing_rules()
