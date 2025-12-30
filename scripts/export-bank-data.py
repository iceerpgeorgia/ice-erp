"""
Export bank transactions and raw bank data from Supabase to JSON files
"""
import os
import json
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, date
from decimal import Decimal

# Load environment variables
load_dotenv()

# Get database URL
SUPABASE_DB = os.getenv('DATABASE_URL')
if SUPABASE_DB and '?schema=' in SUPABASE_DB:
    SUPABASE_DB = SUPABASE_DB.split('?schema=')[0]

# Output directory
OUTPUT_DIR = 'bank_data_export'

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def export_table(conn, table_name, order_by='id'):
    """Export table data to JSON file"""
    print(f"\n📋 Exporting {table_name}...")
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT * FROM {table_name} ORDER BY {order_by}")
        rows = cur.fetchall()
        
        if not rows:
            print(f"   ⚠️  No data found in {table_name}")
            return
        
        # Convert to list of dicts
        data = [dict(row) for row in rows]
        
        # Save to JSON
        filename = f"{OUTPUT_DIR}/{table_name}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=json_serial, ensure_ascii=False)
        
        print(f"   ✅ Exported {len(data)} rows to {filename}")
        return len(data)

def main():
    print("🚀 Starting bank data export from Supabase...")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Create output directory
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"📁 Created directory: {OUTPUT_DIR}\n")
    
    try:
        print("🔌 Connecting to Supabase...")
        conn = psycopg2.connect(SUPABASE_DB)
        print("✓ Connected to Supabase\n")
        
        total_rows = 0
        
        # Export banks table
        rows = export_table(conn, 'banks', 'id')
        if rows: total_rows += rows
        
        # Export bank_accounts table
        rows = export_table(conn, 'bank_accounts', 'id')
        if rows: total_rows += rows
        
        # Export consolidated_bank_accounts table
        rows = export_table(conn, 'consolidated_bank_accounts', 'id')
        if rows: total_rows += rows
        
        # Check for raw bank transaction tables
        with conn.cursor() as cur:
            cur.execute("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND (tablename LIKE '%raw%bank%' OR tablename LIKE '%bog%')
                ORDER BY tablename
            """)
            raw_tables = cur.fetchall()
            
            if raw_tables:
                print(f"\n📦 Found {len(raw_tables)} raw bank data tables:")
                for (table,) in raw_tables:
                    print(f"   - {table}")
                    rows = export_table(conn, table, 'id')
                    if rows: total_rows += rows
        
        print("\n" + "="*60)
        print(f"✅ Successfully exported {total_rows} total rows!")
        print(f"📁 Files saved in: {OUTPUT_DIR}/")
        print("="*60)
        
        # Create import script
        import_script = f"""
# Import bank data from JSON files

import json
import psycopg2
from datetime import datetime

LOCAL_DB = 'postgresql://postgres:admin@localhost:5432/ice_erp'

def import_table(conn, table_name, data):
    print(f"Importing {{table_name}}...")
    with conn.cursor() as cur:
        # Clear existing data
        cur.execute(f"TRUNCATE TABLE {{table_name}} RESTART IDENTITY CASCADE")
        
        if not data:
            return
        
        # Get column names
        columns = list(data[0].keys())
        cols = ', '.join(columns)
        placeholders = ', '.join(['%s'] * len(columns))
        
        # Insert data
        for row in data:
            values = [row[col] for col in columns]
            cur.execute(f"INSERT INTO {{table_name}} ({{cols}}) VALUES ({{placeholders}})", values)
        
        conn.commit()
        print(f"✓ Imported {{len(data)}} rows into {{table_name}}")

# Connect to local database
conn = psycopg2.connect(LOCAL_DB)

# Import each table
tables = ['banks', 'bank_accounts', 'consolidated_bank_accounts']
for table in tables:
    with open(f'{{table}}.json', 'r') as f:
        data = json.load(f)
    import_table(conn, table, data)

conn.close()
print("\\n✅ All data imported!")
"""
        
        with open(f"{OUTPUT_DIR}/import_to_local.py", 'w') as f:
            f.write(import_script)
        
        print(f"\n📝 Created import script: {OUTPUT_DIR}/import_to_local.py")
        print(f"   Run this script when your local PostgreSQL is ready")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        raise
    
    finally:
        if 'conn' in locals():
            conn.close()
            print("\n🔌 Closed Supabase connection")

if __name__ == '__main__':
    main()
