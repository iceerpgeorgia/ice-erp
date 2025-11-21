import psycopg2
import sys

sys.stdout.reconfigure(encoding='utf-8')

LOCAL_DATABASE_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def apply_computed_columns(conn, db_name):
    """Apply computed column definitions to counteragents table using triggers"""
    cur = conn.cursor()
    
    try:
        print(f"\n{'='*80}")
        print(f"Applying computed columns to {db_name} database")
        print(f"{'='*80}\n")
        
        # Ensure the columns exist as regular TEXT columns
        print("Step 1: Ensuring computed columns exist as TEXT fields...")
        cur.execute("""
            DO $$ 
            BEGIN
                BEGIN
                    ALTER TABLE counteragents ADD COLUMN entity_type TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE counteragents ADD COLUMN country TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE counteragents ADD COLUMN counteragent TEXT;
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        """)
        conn.commit()
        print("✓ Ensured columns exist\n")
        
        # Create or replace the trigger function to populate computed columns
        print("Step 2: Creating trigger function to populate computed columns...")
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
                
                -- Update counteragent (formatted display name)
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
        print("✓ Created trigger function\n")
        
        # Drop existing trigger if it exists
        print("Step 3: Setting up trigger...")
        cur.execute("""
            DROP TRIGGER IF EXISTS trg_update_counteragent_computed 
            ON counteragents;
        """)
        
        # Create the trigger
        cur.execute("""
            CREATE TRIGGER trg_update_counteragent_computed
            BEFORE INSERT OR UPDATE ON counteragents
            FOR EACH ROW
            EXECUTE FUNCTION update_counteragent_computed_columns();
        """)
        conn.commit()
        print("✓ Created trigger\n")
        
        # Update existing rows to populate computed columns
        print("Step 4: Populating computed columns for existing rows...")
        
        # First update entity_type
        cur.execute("""
            UPDATE counteragents c
            SET entity_type = et.name_ka
            FROM entity_types et
            WHERE et.entity_type_uuid = c.entity_type_uuid::uuid;
        """)
        print(f"  ✓ Updated entity_type for {cur.rowcount} rows")
        
        # Then update country
        cur.execute("""
            UPDATE counteragents c
            SET country = co.name_ka
            FROM countries co
            WHERE co.country_uuid = c.country_uuid::uuid;
        """)
        print(f"  ✓ Updated country for {cur.rowcount} rows")
        
        # Finally update counteragent (using the entity_type we just populated)
        cur.execute("""
            UPDATE counteragents
            SET counteragent = name || 
                COALESCE(' (ს.კ. ' || identification_number || ')', '') ||
                COALESCE(' - ' || entity_type, '')
            WHERE name IS NOT NULL;
        """)
        print(f"  ✓ Updated counteragent for {cur.rowcount} rows")
        
        rows_updated = cur.rowcount
        conn.commit()
        print(f"\n✓ Populated computed columns for existing rows\n")
        
        # Create indexes
        print("Step 5: Creating indexes on computed columns...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_counteragents_entity_type 
            ON counteragents(entity_type);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_counteragents_country 
            ON counteragents(country);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_counteragents_counteragent 
            ON counteragents(counteragent);
        """)
        conn.commit()
        print("✓ Created indexes\n")
        
        # Verify computed columns
        print("Step 6: Verifying computed columns...")
        cur.execute("""
            SELECT 
                name,
                identification_number,
                entity_type,
                country,
                counteragent
            FROM counteragents
            WHERE counteragent_uuid IS NOT NULL
            ORDER BY id DESC
            LIMIT 5;
        """)
        
        results = cur.fetchall()
        print("\nSample records with computed columns:")
        print(f"{'='*120}")
        print(f"{'Name':<40} {'ID Number':<15} {'Entity Type':<25} {'Country':<15} {'Counteragent':<50}")
        print(f"{'='*120}")
        
        for row in results:
            name = (row[0] or '')[:40]
            id_num = (row[1] or '')[:15]
            entity_type = (row[2] or '')[:25]
            country = (row[3] or '')[:15]
            counteragent = (row[4] or '')[:50]
            print(f"{name:<40} {id_num:<15} {entity_type:<25} {country:<15} {counteragent:<50}")
        
        print(f"{'='*120}\n")
        
        print(f"\n✅ Successfully applied computed columns to {db_name} database!\n")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error applying computed columns to {db_name}: {e}")
        raise
    finally:
        cur.close()

def main():
    print("\n" + "="*80)
    print("APPLYING COMPUTED COLUMNS TO COUNTERAGENTS TABLE")
    print("="*80)
    
    # Apply to local database first
    print("\n🔧 Connecting to LOCAL database...")
    try:
        local_conn = psycopg2.connect(LOCAL_DATABASE_URL)
        apply_computed_columns(local_conn, "LOCAL")
        local_conn.close()
    except Exception as e:
        print(f"❌ Failed to apply to local database: {e}")
        return
    
    # Then apply to Supabase
    print("\n🔧 Connecting to SUPABASE database...")
    try:
        remote_conn = psycopg2.connect(REMOTE_DATABASE_URL)
        apply_computed_columns(remote_conn, "SUPABASE")
        remote_conn.close()
    except Exception as e:
        print(f"❌ Failed to apply to Supabase database: {e}")
        return
    
    print("\n" + "="*80)
    print("✅ COMPUTED COLUMNS APPLIED SUCCESSFULLY TO BOTH DATABASES!")
    print("="*80)
    print("\nNext steps:")
    print("  1. Update Prisma schema to mark these columns as computed")
    print("  2. Run 'npx prisma generate' to update Prisma client")
    print("  3. Verify in the app that entity types and countries show names instead of UUIDs")
    print()

if __name__ == "__main__":
    main()
