import csv
import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

# Load environment variables
load_dotenv('.env.local')

# Get database URL
database_url = os.getenv('POSTGRES_URL')

if not database_url:
    print("Error: POSTGRES_URL not found in .env.local")
    exit(1)

# Connect to database
conn = psycopg2.connect(database_url)
cur = conn.cursor()

try:
    # Truncate the table
    print("Truncating financial_codes table...")
    cur.execute("TRUNCATE TABLE financial_codes CASCADE;")
    conn.commit()
    print("Table truncated successfully.")
    
    # Read CSV file
    print("Reading CSV file...")
    with open('financial_codes.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"Found {len(rows)} rows in CSV")
    
    # First pass: Create a map of code -> uuid
    code_to_uuid = {}
    for row in rows:
        code = row['code'].strip()
        uuid = row['uuid'].strip().lower()  # Lowercase the UUID
        if code and uuid:
            code_to_uuid[code] = uuid
    
    print(f"Built code-to-uuid map with {len(code_to_uuid)} entries")
    
    # Second pass: Prepare data for insert
    insert_data = []
    for row in rows:
        code = row['code'].strip()
        uuid = row['uuid'].strip().lower()
        name = row['name'].strip()
        
        if not code or not uuid or not name:
            continue
        
        # Calculate parent_uuid based on code structure
        parent_uuid = None
        if '.' in code:
            # Get parent code by removing last segment
            parts = code.split('.')
            parent_code = '.'.join(parts[:-1])
            parent_uuid = code_to_uuid.get(parent_code)
        
        # Calculate depth
        depth = code.count('.') + 1
        
        # Parse boolean values
        applies_to_pl = row['applies_to_pl'].strip().upper() == 'TRUE'
        applies_to_cf = row['applies_to_cf'].strip().upper() == 'TRUE'
        is_income = row['is_income'].strip().upper() == 'TRUE'
        
        # Generate validation
        income_indicator = " (+) " if is_income else " (-) "
        validation = f"{code}.{income_indicator}{name}"
        
        insert_data.append({
            'uuid': uuid,
            'code': code,
            'name': name,
            'validation': validation,
            'applies_to_pl': applies_to_pl,
            'applies_to_cf': applies_to_cf,
            'is_income': is_income,
            'parent_uuid': parent_uuid,
            'depth': depth,
            'sort_order': 0,  # Will be fixed later
            'is_active': True
        })
    
    print(f"Prepared {len(insert_data)} records for insert")
    
    # Insert all records
    print("Inserting records...")
    insert_query = """
        INSERT INTO financial_codes 
        (uuid, code, name, validation, applies_to_pl, applies_to_cf, is_income, parent_uuid, depth, sort_order, is_active)
        VALUES %s
    """
    
    values = [
        (
            d['uuid'], d['code'], d['name'], d['validation'],
            d['applies_to_pl'], d['applies_to_cf'], d['is_income'],
            d['parent_uuid'], d['depth'], d['sort_order'], d['is_active']
        )
        for d in insert_data
    ]
    
    execute_values(cur, insert_query, values)
    conn.commit()
    print(f"Inserted {len(insert_data)} records successfully")
    
    # Fix sort_order
    print("Fixing sort_order...")
    
    # Update root level codes
    cur.execute("""
        WITH ranked_roots AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY code) as rn
            FROM financial_codes
            WHERE parent_uuid IS NULL
        )
        UPDATE financial_codes fc
        SET sort_order = rr.rn
        FROM ranked_roots rr
        WHERE fc.id = rr.id;
    """)
    
    # Update child codes
    cur.execute("""
        WITH ranked_children AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY parent_uuid ORDER BY code) as rn
            FROM financial_codes
            WHERE parent_uuid IS NOT NULL
        )
        UPDATE financial_codes fc
        SET sort_order = rc.rn
        FROM ranked_children rc
        WHERE fc.id = rc.id;
    """)
    
    conn.commit()
    print("Sort order fixed successfully")
    
    # Verify results
    cur.execute("SELECT COUNT(*) FROM financial_codes;")
    count = cur.fetchone()[0]
    print(f"\nImport complete! Total records: {count}")
    
    # Show sample
    cur.execute("""
        SELECT code, name, parent_uuid, depth, sort_order 
        FROM financial_codes 
        ORDER BY depth, sort_order, code 
        LIMIT 10;
    """)
    
    print("\nSample records:")
    for row in cur.fetchall():
        print(f"  {row[0]:<15} {row[1]:<40} parent: {str(row[2])[:8]}... depth: {row[3]} sort: {row[4]}")
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    raise
finally:
    cur.close()
    conn.close()
