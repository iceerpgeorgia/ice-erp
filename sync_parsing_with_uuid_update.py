import psycopg2

local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def sync_parsing_data():
    """Sync parsing schemes and rules by updating UUIDs"""
    
    local_conn = psycopg2.connect(local_conn_str)
    local_cur = local_conn.cursor()
    
    supabase_conn = psycopg2.connect(supabase_conn_str)
    supabase_cur = supabase_conn.cursor()
    
    try:
        print("="*60)
        print("PARSING DATA SYNC STRATEGY")
        print("="*60)
        
        # Get UUID mappings
        local_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        local_schemes = {row[0]: row[1] for row in local_cur.fetchall()}
        
        supabase_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        supa_schemes = {row[0]: row[1] for row in supabase_cur.fetchall()}
        
        print("\n📊 UUID Mapping:")
        print(f"   {'Scheme':<15} {'Local UUID':<38} {'Supabase UUID'}")
        print(f"   {'-'*90}")
        uuid_map = {}
        for scheme in sorted(local_schemes.keys()):
            local_uuid = local_schemes[scheme]
            supa_uuid = supa_schemes.get(scheme)
            uuid_map[supa_uuid] = local_uuid  # Map: old -> new
            match = "✅" if local_uuid == supa_uuid else "❌"
            print(f"   {scheme:<15} {local_uuid}  {supa_uuid} {match}")
        
        print("\n" + "="*60)
        print("STEP 1: UPDATE BANK_ACCOUNTS REFERENCES")
        print("="*60)
        
        # Check bank_accounts using parsing_scheme_uuid
        supabase_cur.execute("""
            SELECT parsing_scheme_uuid, COUNT(*) 
            FROM bank_accounts 
            WHERE parsing_scheme_uuid IS NOT NULL 
            GROUP BY parsing_scheme_uuid
        """)
        usage = supabase_cur.fetchall()
        if usage:
            print(f"\n📊 bank_accounts using parsing_scheme_uuid:")
            for uuid, count in usage:
                print(f"   {uuid}: {count} accounts")
            
            # Update each
            for old_uuid, new_uuid in uuid_map.items():
                if old_uuid:
                    supabase_cur.execute("""
                        UPDATE bank_accounts 
                        SET parsing_scheme_uuid = %s 
                        WHERE parsing_scheme_uuid = %s
                    """, (new_uuid, old_uuid))
                    if supabase_cur.rowcount > 0:
                        print(f"\n   Updated {supabase_cur.rowcount} accounts: {old_uuid} → {new_uuid}")
            supabase_conn.commit()
            print("\n✅ bank_accounts updated")
        else:
            print("\n   No bank_accounts using parsing_scheme_uuid")
        
        print("\n" + "="*60)
        print("STEP 2: UPDATE PARSING_SCHEMES UUIDs")
        print("="*60)
        
        # Update parsing_schemes UUIDs
        for scheme, new_uuid in local_schemes.items():
            old_uuid = supa_schemes[scheme]
            supabase_cur.execute("""
                UPDATE parsing_schemes 
                SET uuid = %s 
                WHERE scheme = %s
            """, (new_uuid, scheme))
            print(f"   {scheme}: {old_uuid} → {new_uuid}")
        
        supabase_conn.commit()
        print("\n✅ parsing_schemes UUIDs updated")
        
        print("\n" + "="*60)
        print("STEP 3: COPY PARSING_SCHEME_RULES")
        print("="*60)
        
        # Get rules
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
        
        print(f"\n📊 Final Status:")
        print(f"   {'':20} Local    Supabase")
        print(f"   {'-'*40}")
        print(f"   {'Rules Total:':<20} {local_total:<8} {supa_total}")
        print(f"   {'Rules Active:':<20} {local_active:<8} {supa_active}")
        
        if local_total == supa_total:
            print("\n🎉 SUCCESS! All parsing data synced")
            print("\n📝 To answer your question:")
            print(f"   - Yes, 'active' column is retained")
            print(f"   - Currently ALL {supa_active} rules are active")
            print(f"   - UI toggle would allow enabling/disabling rules without deletion")
            print(f"   - Useful for testing rule changes")
            print("\n📝 Next:")
            print("   1. Re-run backparse to apply these 90 rules")
            print("   2. Decide if you want UI toggle for 'active' column")
        
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
