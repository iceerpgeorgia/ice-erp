import sys
sys.path.insert(0, '.')
from import_bank_xml_data import get_db_connections

remote_conn, local_conn = get_db_connections()
cur = local_conn.cursor()
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='consolidated_bank_accounts' 
    ORDER BY ordinal_position
""")

print("Columns in consolidated_bank_accounts:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

local_conn.close()
remote_conn.close()
