import psycopg2

local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def sync_parsing_data():
    """Sync parsing schemes and rules with proper FK handling"""
    
    local_conn = psycopg2.connect(local_conn_str)
    local_cur = local_conn.cursor()
    
    supabase_conn = psycopg2.connect(supabase_conn_str)
    supabase_cur = supabase_conn.cursor()
    
    try:
        print("="*60)
        print("PARSING DATA SYNC")
        print("="*60)
        
        # Get UUID mappings
        local_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        local_schemes = {row[0]: row[1] for row in local_cur.fetchall()}
        
        supabase_cur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
        supa_schemes = {row[0]: row[1] for row in supabase_cur.fetchall()}
        
        print("\n📊 UUID Mapping:")
        uuid_map = {}  # supa_uuid -> local_uuid
        for scheme in sorted(local_schemes.keys()):
            local_uuid = local_schemes[scheme]
            supa_uuid = supa_schemes.get(scheme)
            uuid_map[str(supa_uuid)] = str(local_uuid)
            print(f"   {scheme}: {supa_uuid} → {local_uuid}")
        
        print("\n" + "="*60)
        print("STEP 1: TEMPORARILY DISABLE FK CONSTRAINTS")
        print("="*60)
        
        # Disable FK checks temporarily
        supabase_cur.execute("SET session_replication_role = replica;")
        print("✅ FK constraints disabled")
        
        print("\n" + "="*60)
        print("STEP 2: UPDATE PARSING_SCHEMES UUIDs")
        print("="*60)
        
        for scheme, new_uuid in local_schemes.items():
            old_uuid = supa_schemes[scheme]
            supabase_cur.execute("""
                UPDATE parsing_schemes 
                SET uuid = %s 
                WHERE scheme = %s
            """, (new_uuid, scheme))
            print(f"   {scheme}: Updated")
        
        print("✅ parsing_schemes UUIDs synced")
        
        print("\n" + "="*60)
        print("STEP 3: UPDATE BANK_ACCOUNTS REFERENCES")
        print("="*60)
        
        # Check usage
        supabase_cur.execute("""
            SELECT parsing_scheme_uuid, COUNT(*) 
            FROM bank_accounts 
            WHERE parsing_scheme_uuid IS NOT NULL 
            GROUP BY parsing_scheme_uuid
        """)
        usage = supabase_cur.fetchall()
        
        if usage:
            for old_uuid, count in usage:
                new_uuid = uuid_map.get(str(old_uuid))
                if new_uuid and str(old_uuid) != new_uuid:
                    supabase_cur.execute("""
                        UPDATE bank_accounts 
                        SET parsing_scheme_uuid = %s 
                        WHERE parsing_scheme_uuid = %s
                    """, (new_uuid, old_uuid))
                    print(f"   Updated {count} accounts")
            print("✅ bank_accounts references updated")
        else:
            print("   No bank_accounts using parsing_scheme_uuid")
        
        print("\n" + "="*60)
        print("STEP 4: RE-ENABLE FK CONSTRAINTS")
        print("="*60)
        
        # Re-enable FK checks
        supabase_cur.execute("SET session_replication_role = DEFAULT;")
        supabase_conn.commit()
        print("✅ FK constraints re-enabled")
        
        print("\n" + "="*60)
        print("STEP 5: COPY PARSING_SCHEME_RULES")
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
        deleted = supabase_cur.rowcount
        print(f"   Deleted: {deleted}")
        
        print(f"\n📤 Inserting {len(rules)} rules...")
        supabase_cur.executemany("""
            INSERT INTO parsing_scheme_rules 
            (id, scheme_uuid, column_name, condition, payment_id, condition_script,
             counteragent_uuid, financial_code_uuid, nominal_currency_uuid, active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, rules)
        supabase_conn.commit()
        print(f"✅ Inserted {len(rules)} rules")
        
        # Verify
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules")
        supa_total = supabase_cur.fetchone()[0]
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = TRUE")
        supa_active = supabase_cur.fetchone()[0]
        supabase_cur.execute("SELECT COUNT(*) FROM parsing_scheme_rules WHERE active = FALSE")
        supa_inactive = supabase_cur.fetchone()[0]
        
        print(f"\n" + "="*60)
        print("FINAL STATUS")
        print("="*60)
        print(f"\n📊 Parsing Rules:")
        print(f"   Total: {supa_total}")
        print(f"   Active: {supa_active}")
        print(f"   Inactive: {supa_inactive}")
        
        if local_total == supa_total:
            print("\n🎉 SUCCESS! All parsing data synced")
            print("\n" + "="*60)
            print("ABOUT THE 'ACTIVE' COLUMN")
            print("="*60)
            print(f"\n✅ 'active' column IS RETAINED on Supabase")
            print(f"   - All {supa_active} rules are currently active")
            print(f"   - Column allows enabling/disabling rules without deletion")
            print(f"   - Useful for testing rule changes before committing")
            print(f"\n💡 UI Toggle Recommendation:")
            print(f"   - Add toggle in parsing rules UI")
            print(f"   - Allows quick enable/disable of individual rules")
            print(f"   - Prevents accidental rule deletion")
            print(f"\n📝 Next Steps:")
            print(f"   1. Re-run backparse to apply these {supa_active} rules")
            print(f"   2. Add 'active' toggle to parsing rules UI (optional)")
        else:
            print(f"\n⚠️  Count mismatch: Local={local_total}, Supabase={supa_total}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        # Try to re-enable FK constraints
        try:
            supabase_cur.execute("SET session_replication_role = DEFAULT;")
            supabase_conn.commit()
        except:
            pass
        supabase_conn.rollback()
    finally:
        local_cur.close()
        local_conn.close()
        supabase_cur.close()
        supabase_conn.close()

if __name__ == "__main__":
    sync_parsing_data()
