import psycopg2
import sys

conn = None
try:
    # Connect to database
    conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
    conn.autocommit = False
    cur = conn.cursor()
    
    print("Step 1: Dropping old projects table (empty, 0 rows)...")
    cur.execute("DROP TABLE IF EXISTS projects CASCADE")
    print("✓ Old table dropped")
    
    print("\nStep 2: Reading migration file...")
    with open('prisma/migrations/create_projects_table.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print("Step 3: Executing migration...")
    cur.execute(sql)
    print("✓ Migration executed")
    
    # Commit transaction
    conn.commit()
    print("\n✅ Migration completed successfully!")
    
    # Verify tables created
    print("\n📋 Verifying tables created:")
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('projects', 'project_employees', 'financial_codes', 'project_states')
        ORDER BY table_name;
    """)
    tables = cur.fetchall()
    for table in tables:
        print(f"  ✓ {table[0]}")
    
    # Show projects table structure
    print("\n📊 Projects table columns:")
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'projects' 
        ORDER BY ordinal_position;
    """)
    columns = cur.fetchall()
    for col in columns:
        nullable = "NULL" if col[2] == "YES" else "NOT NULL"
        print(f"  - {col[0]:<25} {col[1]:<20} {nullable}")
    
    # Check project states
    print("\n📌 Project states inserted:")
    cur.execute("SELECT id, name FROM project_states ORDER BY name")
    states = cur.fetchall()
    for state in states:
        print(f"  {state[0]}: {state[1]}")
    
    # Check functions
    print("\n⚙️  Functions created:")
    cur.execute("""
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name LIKE '%project%'
        ORDER BY routine_name;
    """)
    functions = cur.fetchall()
    for func in functions:
        print(f"  ✓ {func[0]}")
    
    # Check triggers
    print("\n🔔 Triggers created:")
    cur.execute("""
        SELECT trigger_name, event_manipulation 
        FROM information_schema.triggers 
        WHERE event_object_table = 'projects'
        ORDER BY trigger_name;
    """)
    triggers = cur.fetchall()
    for trig in triggers:
        print(f"  ✓ {trig[0]} ({trig[1]})")
    
    cur.close()
    conn.close()
    
except psycopg2.Error as e:
    print(f"\n❌ Database error: {e}")
    if conn:
        conn.rollback()
        conn.close()
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Error: {e}")
    if conn:
        conn.rollback()
        conn.close()
    sys.exit(1)
