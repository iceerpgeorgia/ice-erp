import os
import re
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys
from datetime import datetime
from uuid import uuid4

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("COUNTERAGENTS IMPORT FROM TEMPLATE")
print("="*80)

# Database connection (prefer env var)
def load_env_file(path: str) -> dict:
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip().strip('"')
    return env

def normalize_database_url(url: str) -> str:
    if not url or "?" not in url:
        return url
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    # Remove params that psycopg2 doesn't accept
    for key in ["pgbouncer", "connection_limit"]:
        query.pop(key, None)
    new_query = urlencode(query, doseq=True)
    return urlunparse(parsed._replace(query=new_query))

env_file = load_env_file(".env.local")
DATABASE_URL = os.getenv("DATABASE_URL") or env_file.get("DATABASE_URL") or "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
SUPABASE_DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL") or env_file.get("SUPABASE_DATABASE_URL")
DATABASE_URL = normalize_database_url(DATABASE_URL)
if SUPABASE_DATABASE_URL:
    SUPABASE_DATABASE_URL = normalize_database_url(SUPABASE_DATABASE_URL)

# CLI args
sheet_name = sys.argv[1] if len(sys.argv) > 1 else "Counteragent_new"
file_path = sys.argv[2] if len(sys.argv) > 2 else "templates/counteragent_import_template.xlsx"
target_db = sys.argv[3].lower() if len(sys.argv) > 3 else "local"

if target_db == "supabase" and SUPABASE_DATABASE_URL:
    DATABASE_URL = SUPABASE_DATABASE_URL
elif target_db == "supabase" and not SUPABASE_DATABASE_URL:
    if "supabase.com" in (DATABASE_URL or ""):
        pass
    else:
        raise ValueError("SUPABASE_DATABASE_URL is not set and DATABASE_URL does not look like Supabase.")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Ensure ID sequence is aligned to avoid duplicate primary keys
    cur.execute("""
        SELECT setval('counteragents_id_seq', COALESCE((SELECT MAX(id) FROM counteragents), 0))
    """)
    
    # Read the template
    print(f"\n📄 Reading {file_path} (sheet: {sheet_name})...")
    df = pd.read_excel(file_path, sheet_name=sheet_name)
    print(f"   Found {len(df)} records")

    # Keep only rows that have at least one key field populated
    key_cols = [
        "name",
        "identification_number",
        "counteragent_uuid",
        "entity_type_uuid",
        "country_uuid",
    ]
    df = df[df[key_cols].notna().any(axis=1)].copy()
    print(f"   Active rows after filtering blanks: {len(df)}")
    template_inn_source = df.copy()
    
    # Check required fields
    print("\n✅ Validating required fields...")
    required_fields = ['name']
    for field in required_fields:
        null_count = df[field].isna().sum()
        if null_count > 0:
            print(f"   ⚠️  {field}: {null_count} NULL values found!")
        else:
            print(f"   ✓ {field}: All {len(df)} values present")

    # Ensure counteragent_uuid exists for all rows
    if 'counteragent_uuid' not in df.columns:
        df['counteragent_uuid'] = None
    df['counteragent_uuid'] = df['counteragent_uuid'].astype(object)
    missing_uuid_count = df['counteragent_uuid'].isna().sum()
    if missing_uuid_count > 0:
        print(f"   ℹ️  Generating {missing_uuid_count} missing counteragent_uuid values")
        df.loc[df['counteragent_uuid'].isna(), 'counteragent_uuid'] = [str(uuid4()) for _ in range(missing_uuid_count)]

    # De-duplicate counteragent_uuid values within the file
    duplicated_mask = df['counteragent_uuid'].duplicated(keep='first')
    if duplicated_mask.any():
        dup_count = int(duplicated_mask.sum())
        print(f"   ⚠️  Found {dup_count} duplicate counteragent_uuid values in file; generating new UUIDs for duplicates")
        df.loc[duplicated_mask, 'counteragent_uuid'] = [str(uuid4()) for _ in range(dup_count)]

    # Check duplicates by identification_number in file and database
    print("\n🔍 Checking duplicates by identification_number...")
    if 'identification_number' in df.columns:
        id_series = df['identification_number'].astype(str).str.strip()
        # Skip duplicate IDs inside the file (keep first occurrence)
        file_dups = id_series.duplicated(keep='first') & (id_series != "")
        if file_dups.any():
            dup_values = sorted(set(id_series[file_dups]))
            print(f"   ⚠️  Duplicate identification_number values found in file: {len(dup_values)} (skipping duplicates)")
            for value in dup_values[:10]:
                print(f"      - {value}")
            df = df.loc[~file_dups].copy()

        # Skip rows whose identification_number already exists in DB
        id_values = sorted({
            str(v).strip()
            for v in df['identification_number'].dropna().tolist()
            if str(v).strip() != ""
        })
        if id_values:
            cur.execute("""
                SELECT identification_number
                FROM counteragents
                WHERE identification_number = ANY(%s)
            """, (id_values,))
            existing_ids = {row[0] for row in cur.fetchall()}
            if existing_ids:
                print(f"   ⚠️  identification_number values already exist in database: {len(existing_ids)} (skipping)")
                for value in list(existing_ids)[:10]:
                    print(f"      - {value}")
                df = df[~df['identification_number'].astype(str).str.strip().isin(existing_ids)].copy()
    
    # Validate UUIDs exist in reference tables
    print("\n🔍 Validating foreign keys...")
    
    # Check entity types (skip if column missing)
    if 'entity_type_uuid' in df.columns:
        entity_type_uuids = df['entity_type_uuid'].dropna().unique()
        entity_type_uuids_str = [str(uuid).strip().lower() for uuid in entity_type_uuids if str(uuid).strip()]
        if entity_type_uuids_str:
            cur.execute("""
                SELECT LOWER(entity_type_uuid::text) FROM entity_types 
                WHERE LOWER(entity_type_uuid::text) = ANY(%s)
            """, (entity_type_uuids_str,))
            valid_entity_types = {row[0] for row in cur.fetchall()}
            invalid_entity_types = set(entity_type_uuids_str) - valid_entity_types
        else:
            invalid_entity_types = set()
        
        if invalid_entity_types:
            print(f"   ⚠️  Found {len(invalid_entity_types)} invalid entity type UUIDs:")
            for uuid in list(invalid_entity_types)[:5]:
                print(f"      - {uuid}")
        else:
            print(f"   ✓ All {len(entity_type_uuids)} entity type UUIDs are valid")
    
    # Check countries (skip if column missing)
    if 'country_uuid' in df.columns:
        country_uuids = df['country_uuid'].dropna().unique()
        country_uuids_str = [str(uuid).strip().lower() for uuid in country_uuids if str(uuid).strip()]
        if country_uuids_str:
            cur.execute("""
                SELECT LOWER(country_uuid::text) FROM countries 
                WHERE LOWER(country_uuid::text) = ANY(%s)
            """, (country_uuids_str,))
            valid_countries = {row[0] for row in cur.fetchall()}
            invalid_countries = set(country_uuids_str) - valid_countries
        else:
            invalid_countries = set()
        
        if invalid_countries:
            print(f"   ⚠️  Found {len(invalid_countries)} invalid country UUIDs:")
            for uuid in list(invalid_countries)[:5]:
                print(f"      - {uuid}")
        else:
            print(f"   ✓ All {len(country_uuids)} country UUIDs are valid")
    
    # Check for existing counteragents
    print("\n🔄 Checking for existing counteragents...")
    counteragent_uuids = df['counteragent_uuid'].dropna().unique()
    counteragent_uuids_str = [str(uuid).strip().lower() for uuid in counteragent_uuids if str(uuid).strip()]
    if counteragent_uuids_str:
        cur.execute("""
            SELECT LOWER(counteragent_uuid::text) FROM counteragents 
            WHERE LOWER(counteragent_uuid::text) = ANY(%s)
        """, (counteragent_uuids_str,))
        existing_uuids = {row[0] for row in cur.fetchall()}
    else:
        existing_uuids = set()
    
    if existing_uuids:
        print(f"   ⚠️  Found {len(existing_uuids)} existing counteragents (skipping)")
        df = df[~df['counteragent_uuid'].astype(str).str.strip().str.lower().isin(existing_uuids)].copy()
        print(f"   ℹ️  New records to insert after skipping: {len(df)}")
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
        
        # Convert pension_scheme/is_emploee/is_active/was_emploee to bools where possible
        def to_bool(value, default=False):
            if pd.isna(value):
                return default
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(int(value))
            return str(value).strip().lower() in {"true", "1", "yes", "y"}

        # Ensure UUID is generated before insert
        raw_uuid = str(row.get('counteragent_uuid')).strip()
        if not raw_uuid or raw_uuid.lower() == 'nan':
            raw_uuid = str(uuid4())

        # Prepare record
        record = {
            'counteragent_uuid': raw_uuid.upper(),
            'name': row['name'],
            'identification_number': str(row['identification_number']) if pd.notna(row.get('identification_number')) else None,
            'entity_type_uuid': str(row['entity_type_uuid']).upper() if pd.notna(row.get('entity_type_uuid')) else None,
            'country_uuid': str(row['country_uuid']).upper() if pd.notna(row.get('country_uuid')) else None,
            'is_active': to_bool(row.get('is_active'), default=True),
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
            'entity_type': row.get('entity_type') if pd.notna(row.get('entity_type')) else None,
            'country': row.get('country') if pd.notna(row.get('country')) else None,
            'counteragent': row.get('counteragent') if pd.notna(row.get('counteragent')) else None,
            'internal_number': row.get('internal_number') if pd.notna(row.get('internal_number')) else None,
            'pension_scheme': to_bool(row.get('pension_scheme'), default=False),
            'is_emploee': to_bool(row.get('is_emploee'), default=False),
            'was_emploee': to_bool(row.get('was_emploee'), default=False),
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
                director, director_id, entity_type, country, counteragent,
                internal_number, pension_scheme, is_emploee, was_emploee, updated_at
            ) VALUES %s
        """
        
        values = [
            (
                r['counteragent_uuid'], r['name'], r['identification_number'],
                r['entity_type_uuid'], r['country_uuid'], r['is_active'],
                r['address_line_1'], r['address_line_2'], r['zip_code'],
                r['iban'], r['swift'], r['email'], r['phone'],
                r['birth_or_incorporation_date'], r['director'], r['director_id'],
                r['entity_type'], r['country'], r['counteragent'],
                r['internal_number'], r['pension_scheme'], r['is_emploee'], r['was_emploee'],
                datetime.now()
            )
            for r in records_to_insert
        ]
        
        execute_values(cur, insert_sql, values)
        print(f"   ✓ Inserted {len(records_to_insert)} records")

    # After insert: update deconsolidated tables with counteragents from template
    print("\n🔄 Updating deconsolidated tables for counteragents from template...")

    def normalize_inn(inn_value):
        if not inn_value:
            return None
        text = str(inn_value).strip()
        if len(text) == 10 and text.isdigit():
            return "0" + text
        return text

    def resolve_deconsolidated_table_name(account_number: str, scheme: str) -> str:
        safe_scheme = re.sub(r"[^A-Za-z0-9_]", "_", scheme or "")
        return f"{account_number}_{safe_scheme}"

    template_inns = sorted({
        normalize_inn(value)
        for value in template_inn_source['identification_number'].dropna().tolist()
        if normalize_inn(value)
    })

    counteragent_map = {}
    if template_inns:
        cur.execute("""
            SELECT identification_number, counteragent_uuid::text
            FROM counteragents
            WHERE identification_number = ANY(%s)
        """, (template_inns,))
        for inn_value, uuid_value in cur.fetchall():
            normalized = normalize_inn(inn_value)
            if normalized and uuid_value:
                counteragent_map[normalized] = uuid_value

    if counteragent_map:
        cur.execute("""
            SELECT ba.account_number, ps.scheme
            FROM bank_accounts ba
            LEFT JOIN parsing_schemes ps ON ps.uuid = ba.parsing_scheme_uuid
        """)
        accounts = cur.fetchall()

        update_pairs = list(counteragent_map.items())
        updated_total = 0

        for account_number, scheme in accounts:
            if not account_number or not scheme:
                continue
            table_name = resolve_deconsolidated_table_name(account_number, scheme)

            cur.execute(
                """
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
                """,
                (table_name,),
            )
            if not cur.fetchone():
                continue

            update_sql = f"""
                UPDATE "{table_name}" AS t
                SET counteragent_uuid = v.counteragent_uuid::uuid,
                    counteragent_processed = TRUE,
                    updated_at = NOW()
                FROM (VALUES %s) AS v(counteragent_inn, counteragent_uuid)
                WHERE (
                    CASE
                      WHEN LENGTH(BTRIM(t.counteragent_inn)) = 10
                           AND BTRIM(t.counteragent_inn) ~ '^[0-9]+$'
                        THEN '0' || BTRIM(t.counteragent_inn)
                      ELSE BTRIM(t.counteragent_inn)
                    END
                  ) = v.counteragent_inn
            """

            execute_values(cur, update_sql, update_pairs)
            updated_total += cur.rowcount

        print(f"   ✓ Updated {updated_total} deconsolidated records")
    else:
        print("   ℹ️  No counteragents found for template INNs")
    
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
                    entity_type = %s,
                    country = %s,
                    counteragent = %s,
                    internal_number = %s,
                    pension_scheme = %s,
                    is_emploee = %s,
                    was_emploee = %s,
                    updated_at = %s
                WHERE counteragent_uuid = %s
            """
            
            cur.execute(update_sql, (
                record['name'], record['identification_number'],
                record['entity_type_uuid'], record['country_uuid'], record['is_active'],
                record['address_line_1'], record['address_line_2'], record['zip_code'],
                record['iban'], record['swift'], record['email'], record['phone'],
                record['birth_or_incorporation_date'], record['director'], record['director_id'],
                record['entity_type'], record['country'], record['counteragent'],
                record['internal_number'], record['pension_scheme'], record['is_emploee'], record['was_emploee'],
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
            LEFT JOIN entity_types et ON c.entity_type_uuid = et.entity_type_uuid
            LEFT JOIN countries co ON c.country_uuid = co.country_uuid
            WHERE c.counteragent_uuid = ANY(%s::uuid[])
            LIMIT 5
        """, (list([r['counteragent_uuid'] for r in records_to_insert[:5]]),))
        
        for row in cur.fetchall():
            print(f"   • {row[0]} (ID: {row[1]}) - {row[2]}, {row[3]}")
    
    print("\n" + "="*80)
    print(f"✅ IMPORT COMPLETED SUCCESSFULLY! (target: {target_db})")
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
