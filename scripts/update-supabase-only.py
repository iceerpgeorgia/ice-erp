import psycopg2
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

REMOTE_DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

print("\n" + "="*80)
print("UPDATING SUPABASE TRIGGER ONLY")
print("="*80)

max_retries = 3
for attempt in range(max_retries):
    try:
        print(f"\n🔧 Connecting to SUPABASE (attempt {attempt + 1}/{max_retries})...")
        conn = psycopg2.connect(REMOTE_DATABASE_URL)
        cur = conn.cursor()
        
        print("✓ Connected\n")
        
        # Update trigger function
        print("Step 1: Updating trigger function...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION update_counteragent_computed_columns()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.entity_type_uuid IS NOT NULL THEN
                    SELECT name_ka INTO NEW.entity_type
                    FROM entity_types
                    WHERE entity_type_uuid = NEW.entity_type_uuid::uuid;
                ELSE
                    NEW.entity_type := NULL;
                END IF;
                
                IF NEW.country_uuid IS NOT NULL THEN
                    SELECT name_ka INTO NEW.country
                    FROM countries
                    WHERE country_uuid = NEW.country_uuid::uuid;
                ELSE
                    NEW.country := NULL;
                END IF;
                
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
        print("✓ Trigger function updated\n")
        
        # Update existing records
        print("Step 2: Updating existing records...")
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
        
        rows = cur.rowcount
        conn.commit()
        print(f"✓ Updated {rows:,} records\n")
        
        # Verify
        print("Step 3: Verifying...")
        cur.execute("""
            SELECT name, internal_number, identification_number, counteragent
            FROM counteragents
            WHERE identification_number IS NULL
            LIMIT 3;
        """)
        
        for row in cur.fetchall():
            print(f"  {row[0][:40]:<40} → {row[3][:60]}")
        
        cur.close()
        conn.close()
        
        print("\n✅ SUCCESS!\n")
        break
        
    except Exception as e:
        print(f"❌ Attempt {attempt + 1} failed: {e}")
        if attempt < max_retries - 1:
            wait = (attempt + 1) * 10
            print(f"   Waiting {wait} seconds before retry...")
            time.sleep(wait)
        else:
            print("\n❌ All attempts failed")
            sys.exit(1)
