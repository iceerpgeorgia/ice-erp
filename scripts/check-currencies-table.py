import psycopg2
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Check if currencies table exists
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'currencies'
        );
    """)
    table_exists = cur.fetchone()[0]
    
    if not table_exists:
        print("❌ Currencies table does NOT exist in the database")
        print("\n📋 Available tables in public schema:")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = cur.fetchall()
        for table in tables:
            print(f"  - {table[0]}")
    else:
        print("✅ Currencies table EXISTS\n")
        
        # Get table structure
        print("📊 TABLE STRUCTURE:")
        print("=" * 120)
        cur.execute("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'currencies'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        
        print(f"{'Column Name':<30} {'Data Type':<20} {'Max Length':<15} {'Nullable':<10} {'Default'}")
        print("-" * 120)
        for col in columns:
            col_name, data_type, max_len, nullable, default = col
            max_len_str = str(max_len) if max_len else '-'
            default_str = str(default)[:40] if default else '-'
            print(f"{col_name:<30} {data_type:<20} {max_len_str:<15} {nullable:<10} {default_str}")
        
        # Get record count
        print("\n📈 RECORD COUNT:")
        print("=" * 120)
        cur.execute("SELECT COUNT(*) FROM currencies;")
        count = cur.fetchone()[0]
        print(f"Total records: {count}")
        
        if count > 0:
            # Show sample records
            print("\n📋 SAMPLE RECORDS (first 10):")
            print("=" * 120)
            cur.execute("""
                SELECT * FROM currencies 
                ORDER BY id 
                LIMIT 10;
            """)
            records = cur.fetchall()
            
            # Get column names
            cur.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'currencies'
                ORDER BY ordinal_position;
            """)
            col_names = [col[0] for col in cur.fetchall()]
            
            # Print header
            print(" | ".join(f"{name:<15}" for name in col_names))
            print("-" * 120)
            
            # Print records
            for record in records:
                values = []
                for val in record:
                    if val is None:
                        values.append("NULL")
                    elif isinstance(val, str):
                        values.append(val[:15])
                    else:
                        values.append(str(val)[:15])
                print(" | ".join(f"{val:<15}" for val in values))
        
        # Check indexes
        print("\n🔑 INDEXES:")
        print("=" * 120)
        cur.execute("""
            SELECT 
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'currencies'
            AND schemaname = 'public';
        """)
        indexes = cur.fetchall()
        if indexes:
            for idx_name, idx_def in indexes:
                print(f"  {idx_name}:")
                print(f"    {idx_def}")
        else:
            print("  No indexes found")
        
        # Check constraints
        print("\n🔒 CONSTRAINTS:")
        print("=" * 120)
        cur.execute("""
            SELECT 
                conname,
                contype,
                pg_get_constraintdef(oid) as definition
            FROM pg_constraint
            WHERE conrelid = 'currencies'::regclass;
        """)
        constraints = cur.fetchall()
        if constraints:
            for con_name, con_type, definition in constraints:
                type_map = {'p': 'PRIMARY KEY', 'u': 'UNIQUE', 'f': 'FOREIGN KEY', 'c': 'CHECK'}
                print(f"  {con_name} ({type_map.get(con_type, con_type)}):")
                print(f"    {definition}")
        else:
            print("  No constraints found")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
