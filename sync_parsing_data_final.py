import psycopg2

local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def sync_parsing_data():
    """Sync parsing_schemes and parsing_scheme_rules from local to Supabase"""
    
    local_conn = psycopg2.connect(local_conn_str)
    local_cur = local_conn.cursor()
    
    supabase_conn = psycopg2.connect(supabase_conn_str)
    supabase_cur = supabase_conn.cursor()
    
    try:
        print("="*60)
        print("STEP 1: SYNC PARSING_SCHEMES")
        print("="*60)
        
        # Get schemes from local
        local_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        local_schemes = local_cur.fetchall()
        print(f"\n📊 Local: {len(local_schemes)} schemes")
        for row in local_schemes:
            print(f"   {row[0]:<15} {row[1]}")
        
        # Clear and sync to Supabase
        print(f"\n🗑️  Clearing Supabase parsing_schemes...")
        supabase_cur.execute("DELETE FROM parsing_schemes")
        print(f"   Deleted: {supabase_cur.rowcount}")
        
        print(f"\n📤 Inserting {len(local_schemes)} schemes...")
        supabase_cur.executemany(
            "INSERT INTO parsing_schemes (scheme, uuid) VALUES (%s, %s)",
            local_schemes
        )
        supabase_conn.commit()
        print(f"✅ Synced")
        
        # Verify
        supabase_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        supa_schemes = supabase_cur.fetchall()
        print(f"\n📊 Supabase: {len(supa_schemes)} schemes")
        for row in supa_schemes:
            print(f"   {row[0]:<15} {row[1]}")
        
        if local_schemes == supa_schemes:
            print("\n✅ UUIDs now match!")
        else:
            print("\n❌ Still don't match!")
            return
        
        print("\n" + "="*60)
        print("STEP 2: COPY PARSING_SCHEME_RULES")
        print("="*60)
        
        # Get rules from local
        local_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules")
        local_total = local_cur.fetchone()[0]
        local_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        local_active = local_cur.fetchone()[0]
        print(f"\n📊 Local: {local_total} rules ({local_active} active)")
        
        local_cur.execute("""
            SELECT id, scheme_uuid, column_name, condition, payment_id, 
                   condition_script, counteragent_uuid, financial_code_uuid, 
                   nominal_currency_uuid, active
            FROM parsing_scheme_rules
            ORDER BY id
        """)
        rules = local_cur.fetchall()
        
        # Show sample
        if rules:
            print(f"\n📄 First 2 rules:")
            for i in range(min(2, len(rules))):
                print(f"   Rule {rules[i][0]}: {rules[i][3]} (active={rules[i][9]})")
        
        # Clear and insert
        print(f"\n🗑️  Clearing Supabase parsing_scheme_rules...")
        supabase_cur.execute("DELETE FROM parsing_scheme_rules")
        print(f"   Deleted: {supabase_cur.rowcount}")
        
        print(f"\n📤 Inserting {len(rules)} rules...")
        supabase_cur.executemany("""
            INSERT INTO parsing_scheme_rules 
            (id, scheme_uuid, column_name, condition, payment_id, condition_script,
             counteragent_uuid, financial_code_uuid, nominal_currency_uuid, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, rules)
        supabase_conn.commit()
        print(f"✅ Inserted")
        
        # Verify
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules")
        supa_total = supabase_cur.fetchone()[0]
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        supa_active = supabase_cur.fetchone()[0]
        
        print(f"\n📊 Verification:")
        print(f"   {'':20} Local    Supabase")
        print(f"   {'-'*40}")
        print(f"   {'Total:':<20} {local_total:<8} {supa_total}")
        print(f"   {'Active:':<20} {local_active:<8} {supa_active}")
        
        if local_total == supa_total:
            print("\n🎉 SUCCESS! All parsing data synced")
            print("\n📝 Next:")
            print("   1. Re-run backparse to apply rules")
            print("   2. Decide on 'active' column UI")
        else:
            print("\n⚠️  Mismatch!")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        supabase_conn.rollback()
    finally:
        local_cur.close()
        local_conn.close()
        supabase_cur.close()
        supabase_conn.close()

if __name__ == "__main__":
    sync_parsing_data()
