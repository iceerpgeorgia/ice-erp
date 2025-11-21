import psycopg2
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("SYNC COUNTERAGENTS: LOCAL → SUPABASE")
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
    
    # Get all counteragents from local
    print("\n📤 Fetching counteragents from LOCAL...")
    local_cur.execute("""
        SELECT counteragent_uuid::text, name, identification_number, entity_type_uuid::text,
               country_uuid::text, is_active, address_line_1, address_line_2, zip_code,
               iban, swift, email, phone, birth_or_incorporation_date, 
               director, director_id, updated_at
        FROM counteragents
        ORDER BY updated_at DESC
    """)
    local_records = local_cur.fetchall()
    print(f"   Found {len(local_records)} records in LOCAL")
    
    # Get all counteragents from remote
    print("\n📥 Fetching counteragents from REMOTE...")
    remote_cur.execute("""
        SELECT counteragent_uuid::text, name, identification_number, entity_type_uuid::text,
               country_uuid::text, is_active, address_line_1, address_line_2, zip_code,
               iban, swift, email, phone, birth_or_incorporation_date,
               director, director_id, updated_at
        FROM counteragents
        ORDER BY updated_at DESC
    """)
    remote_records = remote_cur.fetchall()
    print(f"   Found {len(remote_records)} records in REMOTE")
    
    # Create dictionaries for comparison
    local_dict = {row[0]: row for row in local_records}
    remote_dict = {row[0]: row for row in remote_records}
    
    # Find differences
    print("\n🔍 Analyzing differences...")
    only_in_local = set(local_dict.keys()) - set(remote_dict.keys())
    only_in_remote = set(remote_dict.keys()) - set(local_dict.keys())
    in_both = set(local_dict.keys()) & set(remote_dict.keys())
    
    print(f"   Only in LOCAL: {len(only_in_local)}")
    print(f"   Only in REMOTE: {len(only_in_remote)}")
    print(f"   In both: {len(in_both)}")
    
    # Records to insert to remote
    if only_in_local:
        print(f"\n📤 Inserting {len(only_in_local)} new records to REMOTE...")
        
        insert_sql = """
            INSERT INTO counteragents (
                counteragent_uuid, name, identification_number, entity_type_uuid,
                country_uuid, is_active, address_line_1, address_line_2, zip_code,
                iban, swift, email, phone, birth_or_incorporation_date,
                director, director_id, updated_at
            ) VALUES (%s, %s, %s, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        inserted_count = 0
        for uuid in only_in_local:
            record = local_dict[uuid]
            try:
                remote_cur.execute(insert_sql, record)
                inserted_count += 1
                if inserted_count % 50 == 0:
                    print(f"      Inserted {inserted_count}/{len(only_in_local)}...")
            except Exception as e:
                print(f"      ⚠️  Failed to insert {record[1]}: {e}")
        
        remote_conn.commit()
        print(f"   ✓ Inserted {inserted_count} records")
    
    # Records to update in remote (newer local data)
    updates_needed = []
    for uuid in in_both:
        local_rec = local_dict[uuid]
        remote_rec = remote_dict[uuid]
        
        # Compare updated_at timestamps (index 16)
        if local_rec[16] > remote_rec[16]:
            updates_needed.append(uuid)
    
    if updates_needed:
        print(f"\n🔄 Updating {len(updates_needed)} records in REMOTE...")
        
        update_sql = """
            UPDATE counteragents SET
                name = %s,
                identification_number = %s,
                entity_type_uuid = %s::uuid,
                country_uuid = %s::uuid,
                is_active = %s,
                address_line_1 = %s,
                address_line_2 = %s,
                zip_code = %s,
                iban = %s,
                swift = %s,
                email = %s,
                phone = %s,
                birth_or_incorporation_date = %s,
                director = %s,
                director_id = %s,
                updated_at = %s
            WHERE counteragent_uuid = %s::uuid
        """
        
        updated_count = 0
        for uuid in updates_needed:
            record = local_dict[uuid]
            try:
                # Reorder: all fields except uuid, then uuid at end
                remote_cur.execute(update_sql, record[1:] + (record[0],))
                updated_count += 1
                if updated_count % 50 == 0:
                    print(f"      Updated {updated_count}/{len(updates_needed)}...")
            except Exception as e:
                print(f"      ⚠️  Failed to update {record[1]}: {e}")
        
        remote_conn.commit()
        print(f"   ✓ Updated {updated_count} records")
    
    # Final verification
    print("\n✅ Verifying sync...")
    remote_cur.execute("SELECT COUNT(*) FROM counteragents")
    final_count = remote_cur.fetchone()[0]
    print(f"   Total counteragents in REMOTE: {final_count}")
    
    print("\n" + "="*80)
    print("✅ SYNC COMPLETED SUCCESSFULLY!")
    print("="*80)
    print(f"\nSummary:")
    print(f"  • Inserted to REMOTE: {len(only_in_local) if only_in_local else 0}")
    print(f"  • Updated in REMOTE: {len(updates_needed) if updates_needed else 0}")
    print(f"  • Total in REMOTE: {final_count}")
    
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
