import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCAL_DATABASE_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def update_trigger_with_fallback_to_internal(conn, db_name):
    """Update trigger to use internal_number as fallback when identification_number is NULL"""
    cur = conn.cursor()
    
    try:
        print(f"\n{'='*80}")
        print(f"Updating trigger in {db_name} database")
        print(f"{'='*80}\n")
        
        # Create or replace the trigger function with fallback logic
        print("Step 1: Updating trigger function (use internal_number when ID is NULL)...")
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
                
                -- Update counteragent (use internal_number if identification_number is NULL)
                IF NEW.name IS NOT NULL THEN
                    NEW.counteragent := NEW.name ||
                        COALESCE(
                            ' (ს.კ. ' || NEW.identification_number || ')', 
                            ' (ს.კ. ' || NEW.internal_number || ')'
                        ) ||
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
        
        # Update existing rows
        print("Step 2: Updating existing counteragent computed values...")
        cur.execute("""
            UPDATE counteragents
            SET counteragent = name || 
                COALESCE(
                    ' (ს.კ. ' || identification_number || ')', 
                    ' (ს.კ. ' || internal_number || ')'
                ) ||
                COALESCE(' - ' || entity_type, '')
            WHERE name IS NOT NULL;
        """)
        
        rows_updated = cur.rowcount
        conn.commit()
        print(f"✓ Updated {rows_updated:,} records\n")
        
        # Show examples of both formats
        print("Step 3: Verifying updated format...")
        print("\n📋 Records WITH identification_number:")
        print(f"{'='*120}")
        cur.execute("""
            SELECT 
                name,
                internal_number,
                identification_number,
                entity_type,
                counteragent
            FROM counteragents
            WHERE identification_number IS NOT NULL
            ORDER BY internal_number
            LIMIT 3;
        """)
        
        print(f"{'Name':<35} {'Internal':<12} {'ID Number':<15} {'Entity':<20} {'Counteragent':<50}")
        print(f"{'='*120}")
        for row in cur.fetchall():
            name = (row[0] or '')[:35]
            internal = (row[1] or '')[:12]
            id_num = (row[2] or '')[:15]
            entity = (row[3] or '')[:20]
            counteragent = (row[4] or '')[:50]
            print(f"{name:<35} {internal:<12} {id_num:<15} {entity:<20} {counteragent:<50}")
        
        print("\n📋 Records WITHOUT identification_number (using internal_number):")
        print(f"{'='*120}")
        cur.execute("""
            SELECT 
                name,
                internal_number,
                identification_number,
                entity_type,
                counteragent
            FROM counteragents
            WHERE identification_number IS NULL
            ORDER BY internal_number
            LIMIT 5;
        """)
        
        print(f"{'Name':<35} {'Internal':<12} {'ID Number':<15} {'Entity':<20} {'Counteragent':<50}")
        print(f"{'='*120}")
        for row in cur.fetchall():
            name = (row[0] or '')[:35]
            internal = (row[1] or '')[:12]
            id_num = 'NULL'
            entity = (row[3] or '')[:20]
            counteragent = (row[4] or '')[:50]
            print(f"{name:<35} {internal:<12} {id_num:<15} {entity:<20} {counteragent:<50}")
        
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
    print("UPDATING TRIGGER TO USE INTERNAL_NUMBER AS FALLBACK")
    print("="*80)
    print("\nFORMAT LOGIC:")
    print("  If ID Number exists:    Name (ს.კ. ID_NUMBER) - Entity Type")
    print("  If ID Number is NULL:   Name (ს.კ. INTERNAL_NUMBER) - Entity Type")
    print("\nEXAMPLES:")
    print("  ენერგომობილი (ს.კ. 406161549) - შპს")
    print("  KLEEMANN HELLAS S.A. (ს.კ. ICE001226) - უცხოური საწარმო")
    print("="*80)
    
    # Apply to local database first
    print("\n🔧 Connecting to LOCAL database...")
    try:
        local_conn = psycopg2.connect(LOCAL_DATABASE_URL)
        update_trigger_with_fallback_to_internal(local_conn, "LOCAL")
        local_conn.close()
    except Exception as e:
        print(f"❌ Failed to update local database: {e}")
        return
    
    # Then apply to Supabase
    print("\n🔧 Connecting to SUPABASE database...")
    try:
        remote_conn = psycopg2.connect(REMOTE_DATABASE_URL)
        update_trigger_with_fallback_to_internal(remote_conn, "SUPABASE")
        remote_conn.close()
    except Exception as e:
        print(f"❌ Failed to update Supabase database: {e}")
        return
    
    print("\n" + "="*80)
    print("✅ TRIGGER UPDATED SUCCESSFULLY IN BOTH DATABASES!")
    print("="*80)
    print("\nCounterагent field now uses:")
    print("  - identification_number (if available)")
    print("  - internal_number (if identification_number is NULL)")
    print()

if __name__ == "__main__":
    main()
