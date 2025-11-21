import psycopg2
import sys

conn = None
try:
    # Connect to database (% needs to be URL encoded as %25)
    conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
    conn.autocommit = False
    cur = conn.cursor()
    
    # First check the counteragents table structure
    print("Checking counteragents table structure...")
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'counteragents' 
        AND column_name LIKE '%uuid%'
        ORDER BY ordinal_position;
    """)
    columns = cur.fetchall()
    print("UUID columns in counteragents table:")
    for col in columns:
        print(f"  - {col[0]} ({col[1]})")
    
    # Read and execute migration
    print("\nReading migration file...")
    with open('prisma/migrations/create_projects_table.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    
    print("Executing migration...")
    cur.execute(sql)
    
    # Commit transaction
    conn.commit()
    print("\n✅ Migration completed successfully!")
    
    # Verify tables created
    print("\nVerifying tables created:")
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
    
    # Check project states
    print("\nProject states inserted:")
    cur.execute("SELECT id, name FROM project_states ORDER BY name")
    states = cur.fetchall()
    for state in states:
        print(f"  {state[0]}: {state[1]}")
    
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
