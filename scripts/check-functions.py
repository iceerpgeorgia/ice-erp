import psycopg2

conn = psycopg2.connect('postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP')
cur = conn.cursor()

# Check functions
cur.execute("""
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name LIKE '%contract%'
""")
funcs = cur.fetchall()
print('Contract functions:', funcs if funcs else 'None found')

# Check if compute_contract_no exists
cur.execute("""
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'compute_contract_no'
""")
result = cur.fetchone()
print('\ncompute_contract_no exists:', 'Yes' if result else 'No')

cur.close()
conn.close()
