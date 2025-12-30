import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
import os
from dotenv import load_dotenv

load_dotenv()

# Get connection strings
remote_url = os.getenv('REMOTE_DATABASE_URL')
local_url = os.getenv('DATABASE_URL')

# Clean URLs
if '?pgbouncer=' in remote_url:
    remote_url = remote_url.split('?')[0]
if '?schema=' in local_url:
    local_url = local_url.split('?schema=')[0]

print("=" * 60)
print("COPY BANK DATA FROM SUPABASE TO LOCAL")
print("=" * 60)

try:
    # Connect to both databases
    print("\n📡 Connecting to Supabase...")
    remote_conn = psycopg2.connect(remote_url)
    remote_cur = remote_conn.cursor(cursor_factory=RealDictCursor)
    print("   ✅ Connected to Supabase")
    
    print("\n💻 Connecting to local PostgreSQL...")
    local_conn = psycopg2.connect(local_url)
    local_cur = local_conn.cursor()
    print("   ✅ Connected to local database")
    
    # Tables to copy in order (dependencies first)
    tables_config = [
        {
            'name': 'currencies',
            'order_by': 'id',
        },
        {
            'name': 'banks',
            'order_by': 'id',
        },
        {
            'name': 'bank_accounts',
            'order_by': 'id',
        },
        {
            'name': 'bog_gel_raw_893486000',
            'order_by': 'id',
        },
        {
            'name': 'consolidated_bank_accounts',
            'order_by': 'id',
        }
    ]
    
    total_copied = 0
    
    # Clear all tables first in reverse order (to handle foreign keys)
    print("\n🗑️  Clearing existing data...")
    for table_config in reversed(tables_config):
        table_name = table_config['name']
        try:
            local_cur.execute(f'DELETE FROM "{table_name}"')
            local_conn.commit()
            print(f"   ✅ Cleared {table_name}")
        except Exception as e:
            local_conn.rollback()
            print(f"   ⚠️  Could not clear {table_name}: {str(e)[:100]}")
    
    for table_config in tables_config:
        table_name = table_config['name']
        order_by = table_config['order_by']
        
        print(f"\n📦 Processing table: {table_name}")
        print("   " + "-" * 50)
        
        # Get data from Supabase
        remote_cur.execute(f'SELECT * FROM "{table_name}" ORDER BY {order_by}')
        rows = remote_cur.fetchall()
        
        if not rows:
            print(f"   ⚠️  No data found in {table_name}")
            continue
        
        print(f"   📊 Found {len(rows)} rows")
        
        # Get column names
        columns = list(rows[0].keys())
        
        # Insert data in batches
        print(f"   ⬆️  Inserting {len(rows)} rows...")
        
        # Build insert query
        cols = ', '.join([f'"{col}"' for col in columns])
        placeholders = ', '.join(['%s'] * len(columns))
        insert_query = f'INSERT INTO "{table_name}" ({cols}) VALUES ({placeholders})'
        
        # Convert rows to tuples
        values = [tuple(row[col] for col in columns) for row in rows]
        
        # Execute batch insert
        for i, row_values in enumerate(values, 1):
            try:
                local_cur.execute(insert_query, row_values)
                if i % 50 == 0:
                    print(f"      ... {i}/{len(rows)}")
            except Exception as e:
                print(f"      ❌ Error inserting row {i}: {str(e)}")
                print(f"         Row data: {dict(zip(columns, row_values))}")
                raise
        
        local_conn.commit()
        
        # Verify
        local_cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
        count = local_cur.fetchone()[0]
        print(f"   ✅ Copied {count} rows to local {table_name}")
        total_copied += count
    
    # Reset sequences for tables with auto-increment IDs
    print("\n🔄 Resetting sequences...")
    for table_config in tables_config:
        table_name = table_config['name']
        try:
            local_cur.execute(f"""
                SELECT setval(
                    pg_get_serial_sequence('"{table_name}"', 'id'),
                    (SELECT COALESCE(MAX(id), 1) FROM "{table_name}")
                )
            """)
            print(f"   ✅ Reset sequence for {table_name}")
        except Exception as e:
            print(f"   ⚠️  Could not reset sequence for {table_name}: {str(e)}")
    
    local_conn.commit()
    
    # Close connections
    remote_cur.close()
    remote_conn.close()
    local_cur.close()
    local_conn.close()
    
    print("\n" + "=" * 60)
    print(f"✅ SUCCESS! Copied {total_copied} total rows from Supabase to local")
    print("=" * 60)

except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
