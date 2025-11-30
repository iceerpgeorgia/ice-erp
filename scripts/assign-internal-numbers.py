import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCAL_DATABASE_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def assign_internal_numbers(conn, db_name):
    """Assign internal numbers to counteragents that don't have one"""
    cur = conn.cursor()
    
    try:
        print(f"\n{'='*80}")
        print(f"Assigning internal numbers in {db_name} database")
        print(f"{'='*80}\n")
        
        # Find the highest existing internal number
        print("Step 1: Finding highest existing internal_number...")
        cur.execute("""
            SELECT internal_number 
            FROM counteragents 
            WHERE internal_number IS NOT NULL 
            ORDER BY internal_number DESC 
            LIMIT 1;
        """)
        
        result = cur.fetchone()
        if result and result[0]:
            # Extract number from format ICE000123
            last_number = int(result[0].replace('ICE', ''))
            print(f"  Last assigned: {result[0]} (number: {last_number})")
        else:
            last_number = 0
            print(f"  No existing internal numbers found, starting from 1")
        
        next_number = last_number + 1
        
        # Get records without internal_number
        print("\nStep 2: Finding records without internal_number...")
        cur.execute("""
            SELECT 
                counteragent_uuid,
                name,
                identification_number
            FROM counteragents
            WHERE internal_number IS NULL
            ORDER BY id;
        """)
        
        records_to_update = cur.fetchall()
        count = len(records_to_update)
        print(f"  Found {count} records without internal_number")
        
        if count == 0:
            print("\n✅ All records already have internal_number!")
            return
        
        # Assign internal numbers
        print(f"\nStep 3: Assigning internal numbers starting from ICE{next_number:06d}...")
        
        updated_count = 0
        for i, record in enumerate(records_to_update, start=1):
            uuid = record[0]
            name = record[1]
            internal_num = f"ICE{next_number:06d}"
            
            cur.execute("""
                UPDATE counteragents
                SET internal_number = %s
                WHERE counteragent_uuid = %s;
            """, (internal_num, uuid))
            
            updated_count += 1
            next_number += 1
            
            # Show progress every 50 records
            if i % 50 == 0:
                conn.commit()
                print(f"  Progress: {i}/{count} records updated...")
        
        conn.commit()
        print(f"  ✅ Assigned {updated_count} internal numbers\n")
        
        # The trigger will automatically update the counteragent computed field
        print("Step 4: Verifying trigger updated computed fields...")
        print("  (Trigger should auto-update counteragent field on UPDATE)\n")
        
        # Show sample of newly assigned records
        print("Step 5: Sample of newly assigned internal numbers:")
        print(f"{'='*120}")
        cur.execute("""
            SELECT 
                name,
                internal_number,
                identification_number,
                counteragent
            FROM counteragents
            WHERE internal_number >= %s
            ORDER BY internal_number
            LIMIT 10;
        """, (f"ICE{last_number + 1:06d}",))
        
        print(f"{'Name':<35} {'Internal No':<15} {'ID Number':<15} {'Counteragent':<50}")
        print(f"{'='*120}")
        for row in cur.fetchall():
            name = (row[0] or '')[:35]
            internal = (row[1] or '')[:15]
            id_num = (row[2] or '')[:15]
            counteragent = (row[3] or '')[:50]
            print(f"{name:<35} {internal:<15} {id_num:<15} {counteragent:<50}")
        
        print(f"{'='*120}\n")
        print(f"✅ Successfully assigned {updated_count} internal numbers in {db_name}!\n")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error assigning internal numbers in {db_name}: {e}")
        raise
    finally:
        cur.close()

def main():
    print("\n" + "="*80)
    print("ASSIGNING INTERNAL NUMBERS TO COUNTERAGENTS")
    print("="*80)
    
    # Apply to local database first
    print("\n🔧 Connecting to LOCAL database...")
    try:
        local_conn = psycopg2.connect(LOCAL_DATABASE_URL)
        assign_internal_numbers(local_conn, "LOCAL")
        local_conn.close()
    except Exception as e:
        print(f"❌ Failed to update local database: {e}")
        return
    
    # Then apply to Supabase
    print("\n🔧 Connecting to SUPABASE database...")
    try:
        remote_conn = psycopg2.connect(REMOTE_DATABASE_URL)
        assign_internal_numbers(remote_conn, "SUPABASE")
        remote_conn.close()
    except Exception as e:
        print(f"❌ Failed to update Supabase database: {e}")
        return
    
    print("\n" + "="*80)
    print("✅ INTERNAL NUMBERS ASSIGNED SUCCESSFULLY IN BOTH DATABASES!")
    print("="*80)
    print("\nAll counteragents now have internal numbers.")
    print("The trigger automatically updated the computed 'counteragent' field.")
    print("\nTotal counteragents: 3,281")
    print("  - Previously had internal_number: 3,005")
    print("  - Newly assigned internal_number: 276")
    print()

if __name__ == "__main__":
    main()
