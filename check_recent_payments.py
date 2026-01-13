from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()
cur.execute("SELECT id, payment_id FROM payments WHERE id >= 4228 ORDER BY id")
rows = cur.fetchall()
print("Recently copied payments:")
for r in rows:
    print(f"  ID {r[0]}: {r[1]}")

conn2.close()
conn1.close()
