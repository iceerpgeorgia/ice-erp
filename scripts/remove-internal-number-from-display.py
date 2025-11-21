import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCAL_DATABASE_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def update_trigger_without_internal_number(conn, db_name):
    """Update trigger to exclude internal_number from counteragent computed field"""
    cur = conn.cursor()
    
    try:
        print(f"\n{'='*80}")
        print(f"Updating trigger in {db_name} database")
        print(f"{'='*80}\n")
        
        # Create or replace the trigger function WITHOUT internal_number in counteragent
        print("Step 1: Updating trigger function (removing internal_number from counteragent)...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION update_counteragent_computed_columns()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Update entity_type from entity_types table
                IF NEW.entity_type_uuid IS NOT NULL THEN
                    SELECT name_ka INTO NEW.entity_type
                    FROM entity_types
                    WHERE entity_type_uuid = NEW.entity_type_uuid::uuid;
                ELSE
                    NEW.entity_type := NULL;
                END IF;
                
                -- Update country from countries table
                IF NEW.country_uuid IS NOT NULL THEN
                    SELECT name_ka INTO NEW.country
                    FROM countries
                    WHERE country_uuid = NEW.country_uuid::uuid;
                ELSE
                    NEW.country := NULL;
                END IF;
                
                -- Update counteragent (formatted display name WITHOUT internal number)
                IF NEW.name IS NOT NULL THEN
                    NEW.counteragent := NEW.name ||
                        COALESCE(' (ს.კ. ' || NEW.identification_number || ')', '') ||
                        COALESCE(' - ' || NEW.entity_type, '');
                ELSE
                    NEW.counteragent := NULL;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        conn.commit()
        print("✓ Updated trigger function\n")
        
        # Update existing rows to remove internal_number from counteragent field
        print("Step 2: Updating existing counteragent computed values...")
        cur.execute("""
            UPDATE counteragents
            SET counteragent = name || 
                COALESCE(' (ს.კ. ' || identification_number || ')', '') ||
                COALESCE(' - ' || entity_type, '')
            WHERE name IS NOT NULL;
        """)
        
        rows_updated = cur.rowcount
        conn.commit()
        print(f"✓ Updated {rows_updated:,} records\n")
        
        # Verify the updated format
        print("Step 3: Verifying updated format (without internal_number)...")
        cur.execute("""
            SELECT 
                name,
                internal_number,
                identification_number,
                entity_type,
                counteragent
            FROM counteragents
            WHERE internal_number IS NOT NULL
            ORDER BY internal_number
            LIMIT 5;
        """)
        
        results = cur.fetchall()
        print("\nSample records (internal_number exists but NOT in counteragent):")
        print(f"{'='*120}")
        print(f"{'Name':<30} {'Internal No':<15} {'ID Number':<15} {'Entity Type':<20} {'Counteragent':<50}")
        print(f"{'='*120}")
        
        for row in results:
            name = (row[0] or '')[:30]
            internal = (row[1] or '')[:15]
            id_num = (row[2] or '')[:15]
            entity_type = (row[3] or '')[:20]
            counteragent = (row[4] or '')[:50]
            print(f"{name:<30} {internal:<15} {id_num:<15} {entity_type:<20} {counteragent:<50}")
            
            # Verify internal_number is NOT in counteragent
            if internal and internal in counteragent:
                print(f"  ⚠️  WARNING: Internal number still in counteragent!")
            else:
                print(f"  ✓ Internal number correctly excluded")
        
        print(f"{'='*120}\n")
        
        print(f"✅ Successfully updated trigger in {db_name} database!\n")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating trigger in {db_name}: {e}")
        raise
    finally:
        cur.close()

def main():
    print("\n" + "="*80)
    print("UPDATING TRIGGER TO REMOVE INTERNAL_NUMBER FROM COUNTERAGENT FIELD")
    print("="*80)
    print("\nOLD FORMAT: ენერგომობილი [ICE000212] (ს.კ. 406161549) - შპს")
    print("NEW FORMAT: ენერგომობილი (ს.კ. 406161549) - შპს")
    print()
    print("NOTE: internal_number field will still exist, just not displayed in counteragent")
    print("="*80)
    
    # Apply to local database first
    print("\n🔧 Connecting to LOCAL database...")
    try:
        local_conn = psycopg2.connect(LOCAL_DATABASE_URL)
        update_trigger_without_internal_number(local_conn, "LOCAL")
        local_conn.close()
    except Exception as e:
        print(f"❌ Failed to update local database: {e}")
        return
    
    # Then apply to Supabase
    print("\n🔧 Connecting to SUPABASE database...")
    try:
        remote_conn = psycopg2.connect(REMOTE_DATABASE_URL)
        update_trigger_without_internal_number(remote_conn, "SUPABASE")
        remote_conn.close()
    except Exception as e:
        print(f"❌ Failed to update Supabase database: {e}")
        return
    
    print("\n" + "="*80)
    print("✅ TRIGGER UPDATED SUCCESSFULLY IN BOTH DATABASES!")
    print("="*80)
    print("\nCounterагent field format:")
    print("  Name (ს.კ. ID) - Entity Type")
    print("\nInternal numbers are preserved in the internal_number column")
    print("but NOT included in the computed counteragent display field.")
    print()

if __name__ == "__main__":
    main()
