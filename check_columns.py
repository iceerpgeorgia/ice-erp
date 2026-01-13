from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'bog_gel_raw_893486000' ORDER BY ordinal_position")
cols = cur.fetchall()
print("Columns in bog_gel_raw_893486000:")
for c in cols:
    print(f"  {c[0]}")
conn2.close()
conn1.close()
