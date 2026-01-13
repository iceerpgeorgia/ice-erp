from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()
cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'parsing_scheme_rules' ORDER BY ordinal_position")
cols = cur.fetchall()
print("Columns in parsing_scheme_rules:")
for c in cols:
    print(f"  {c[0]}")

print("\nActual data:")
cur.execute("SELECT * FROM parsing_scheme_rules")
rules = cur.fetchall()
for rule in rules:
    print(f"  {rule}")

conn2.close()
conn1.close()
