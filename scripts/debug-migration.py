import psycopg2

conn = None
try:
    conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
    conn.autocommit = False
    cur = conn.cursor()
    
    # Read migration file
    with open('prisma/migrations/create_projects_table.sql', 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # Split into individual statements
    statements = []
    current = []
    in_function = False
    
    for line in sql_content.split('\n'):
        current.append(line)
        
        # Track function blocks
        if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
            in_function = True
        
        # End of statement
        if line.strip().endswith(';') and not in_function:
            statements.append('\n'.join(current))
            current = []
        
        # End of function
        if in_function and '$$ LANGUAGE' in line:
            in_function = False
    
    # Add last statement if exists
    if current:
        statements.append('\n'.join(current))
    
    # Execute one by one
    for i, stmt in enumerate(statements, 1):
        stmt = stmt.strip()
        if not stmt or stmt.startswith('--'):
            continue
        
        print(f"\n[{i}/{len(statements)}] Executing statement...")
        print(f"First 100 chars: {stmt[:100]}...")
        
        try:
            cur.execute(stmt)
            print(f"✓ Success")
        except Exception as e:
            print(f"✗ Failed: {e}")
            print(f"\nFull statement:")
            print(stmt)
            raise
    
    conn.commit()
    print("\n✅ All statements executed successfully!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    if conn:
        conn.rollback()
        conn.close()
