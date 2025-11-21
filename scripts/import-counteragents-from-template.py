import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys
from datetime import datetime

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("COUNTERAGENTS IMPORT FROM TEMPLATE")
print("="*80)

# Database connection
DATABASE_URL = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Read the template
    print("\n📄 Reading counteragent_import_template.xlsx...")
    df = pd.read_excel('templates/counteragent_import_template.xlsx', sheet_name='Counteragent')
    print(f"   Found {len(df)} records")
    
    # Check required fields
    print("\n✅ Validating required fields...")
    required_fields = ['counteragent_uuid', 'name', 'entity_type_uuid', 'country_uuid']
    for field in required_fields:
        null_count = df[field].isna().sum()
        if null_count > 0:
            print(f"   ⚠️  {field}: {null_count} NULL values found!")
        else:
            print(f"   ✓ {field}: All {len(df)} values present")
    
    # Validate UUIDs exist in reference tables
    print("\n🔍 Validating foreign keys...")
    
    # Check entity types
    entity_type_uuids = df['entity_type_uuid'].dropna().unique()
    entity_type_uuids_str = [str(uuid).upper() for uuid in entity_type_uuids]
    cur.execute("""
        SELECT entity_type_uuid::text FROM entity_types 
        WHERE entity_type_uuid::text = ANY(%s)
    """, (entity_type_uuids_str,))
    valid_entity_types = {row[0] for row in cur.fetchall()}
    invalid_entity_types = set(entity_type_uuids_str) - valid_entity_types
    
    if invalid_entity_types:
        print(f"   ⚠️  Found {len(invalid_entity_types)} invalid entity type UUIDs:")
        for uuid in list(invalid_entity_types)[:5]:
            print(f"      - {uuid}")
    else:
        print(f"   ✓ All {len(entity_type_uuids)} entity type UUIDs are valid")
    
    # Check countries
    country_uuids = df['country_uuid'].dropna().unique()
    country_uuids_str = [str(uuid).upper() for uuid in country_uuids]
    cur.execute("""
        SELECT country_uuid::text FROM countries 
        WHERE country_uuid::text = ANY(%s)
    """, (country_uuids_str,))
    valid_countries = {row[0] for row in cur.fetchall()}
    invalid_countries = set(country_uuids_str) - valid_countries
    
    if invalid_countries:
        print(f"   ⚠️  Found {len(invalid_countries)} invalid country UUIDs:")
        for uuid in list(invalid_countries)[:5]:
            print(f"      - {uuid}")
    else:
        print(f"   ✓ All {len(country_uuids)} country UUIDs are valid")
    
    # Check for existing counteragents
    print("\n🔄 Checking for existing counteragents...")
    counteragent_uuids = df['counteragent_uuid'].dropna().unique()
    counteragent_uuids_str = [str(uuid).upper() for uuid in counteragent_uuids]
    cur.execute("""
        SELECT counteragent_uuid::text FROM counteragents 
        WHERE counteragent_uuid::text = ANY(%s)
    """, (counteragent_uuids_str,))
    existing_uuids = {row[0] for row in cur.fetchall()}
    
    if existing_uuids:
        print(f"   ⚠️  Found {len(existing_uuids)} existing counteragents (will be updated)")
        print(f"   ℹ️  New records to insert: {len(counteragent_uuids) - len(existing_uuids)}")
    else:
        print(f"   ✓ No existing records found - all {len(counteragent_uuids)} will be inserted")
    
    # Prepare data for insertion
    print("\n📦 Preparing data...")
    records_to_insert = []
    records_to_update = []
    
    for idx, row in df.iterrows():
        # Convert phone to string if it's a float
        phone = None
        if pd.notna(row.get('phone')):
            phone = str(int(row['phone'])) if isinstance(row['phone'], float) else str(row['phone'])
        
        # Convert director_id to string if it's a float
        director_id = None
        if pd.notna(row.get('director_id')):
            director_id = str(int(row['director_id'])) if isinstance(row['director_id'], float) else str(row['director_id'])
        
        # Prepare record
        record = {
            'counteragent_uuid': str(row['counteragent_uuid']).upper(),
            'name': row['name'],
            'identification_number': str(row['identification_number']) if pd.notna(row.get('identification_number')) else None,
            'entity_type_uuid': str(row['entity_type_uuid']).upper(),
            'country_uuid': str(row['country_uuid']).upper(),
            'is_active': True,  # Default to True since template has all NULL
            'address_line_1': row.get('address_line_1') if pd.notna(row.get('address_line_1')) else None,
            'address_line_2': row.get('address_line_2') if pd.notna(row.get('address_line_2')) else None,
            'zip_code': str(row['zip_code']) if pd.notna(row.get('zip_code')) else None,
            'iban': row.get('iban') if pd.notna(row.get('iban')) else None,
            'swift': row.get('swift') if pd.notna(row.get('swift')) else None,
            'email': row.get('email') if pd.notna(row.get('email')) else None,
            'phone': phone,
            'birth_or_incorporation_date': row.get('birth_or_incorporation_date') if pd.notna(row.get('birth_or_incorporation_date')) else None,
            'director': row.get('director') if pd.notna(row.get('director')) else None,
            'director_id': director_id,
        }
        
        if record['counteragent_uuid'] in existing_uuids:
            records_to_update.append(record)
        else:
            records_to_insert.append(record)
    
    print(f"   Records to insert: {len(records_to_insert)}")
    print(f"   Records to update: {len(records_to_update)}")
    
    # Insert new records
    if records_to_insert:
        print(f"\n📥 Inserting {len(records_to_insert)} new records...")
        
        insert_sql = """
            INSERT INTO counteragents (
                counteragent_uuid, name, identification_number, entity_type_uuid, 
                country_uuid, is_active, address_line_1, address_line_2, zip_code,
                iban, swift, email, phone, birth_or_incorporation_date,
                director, director_id, updated_at
            ) VALUES %s
        """
        
        values = [
            (
                r['counteragent_uuid'], r['name'], r['identification_number'],
                r['entity_type_uuid'], r['country_uuid'], r['is_active'],
                r['address_line_1'], r['address_line_2'], r['zip_code'],
                r['iban'], r['swift'], r['email'], r['phone'],
                r['birth_or_incorporation_date'], r['director'], r['director_id'],
                datetime.now()
            )
            for r in records_to_insert
        ]
        
        execute_values(cur, insert_sql, values)
        print(f"   ✓ Inserted {len(records_to_insert)} records")
    
    # Update existing records
    if records_to_update:
        print(f"\n🔄 Updating {len(records_to_update)} existing records...")
        
        for record in records_to_update:
            update_sql = """
                UPDATE counteragents SET
                    name = %s,
                    identification_number = %s,
                    entity_type_uuid = %s,
                    country_uuid = %s,
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
                WHERE counteragent_uuid = %s
            """
            
            cur.execute(update_sql, (
                record['name'], record['identification_number'],
                record['entity_type_uuid'], record['country_uuid'], record['is_active'],
                record['address_line_1'], record['address_line_2'], record['zip_code'],
                record['iban'], record['swift'], record['email'], record['phone'],
                record['birth_or_incorporation_date'], record['director'], record['director_id'],
                datetime.now(), record['counteragent_uuid']
            ))
        
        print(f"   ✓ Updated {len(records_to_update)} records")
    
    # Commit transaction
    conn.commit()
    
    # Verify import
    print("\n✅ Verifying import...")
    cur.execute("SELECT COUNT(*) FROM counteragents")
    total_count = cur.fetchone()[0]
    print(f"   Total counteragents in database: {total_count}")
    
    # Show sample of newly imported
    if records_to_insert:
        print("\n📋 Sample of newly imported records:")
        cur.execute("""
            SELECT c.name, c.identification_number, et.name_en as entity_type, co.name_en as country
            FROM counteragents c
            JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
            JOIN countries co ON c.country_uuid = co.country_uuid
            WHERE c.counteragent_uuid = ANY(%s)
            LIMIT 5
        """, (list([r['counteragent_uuid'] for r in records_to_insert[:5]]),))
        
        for row in cur.fetchall():
            print(f"   • {row[0]} (ID: {row[1]}) - {row[2]}, {row[3]}")
    
    print("\n" + "="*80)
    print("✅ LOCAL IMPORT COMPLETED SUCCESSFULLY!")
    print("="*80)
    
    cur.close()
    conn.close()

except Exception as e:
    print(f"\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    if 'conn' in locals():
        conn.rollback()
    sys.exit(1)
