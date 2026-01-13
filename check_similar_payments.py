from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()

# Check for similar payment_ids
cur.execute("SELECT payment_id, id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid FROM payments WHERE payment_id LIKE 'ce1311_4e_%'")
rows = cur.fetchall()

print("Payments matching 'ce1311_4e_%':")
for row in rows:
    print(f"  payment_id: {row[0]}")
    print(f"  id: {row[1]}")
    print(f"  counteragent_uuid: {row[2]}")
    print(f"  project_uuid: {row[3]}")
    print(f"  financial_code_uuid: {row[4]}")
    print(f"  currency_uuid: {row[5]}")
    print()

conn2.close()
conn1.close()
