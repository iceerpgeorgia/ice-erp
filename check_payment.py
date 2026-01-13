from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()
cur.execute("SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid FROM payments WHERE payment_id = 'ce1311_4e_3C247b'")
row = cur.fetchone()
if row:
    print("Payment found:")
    print(f"  payment_id: {row[0]}")
    print(f"  counteragent_uuid: {row[1]}")
    print(f"  project_uuid: {row[2]}")
    print(f"  financial_code_uuid: {row[3]}")
    print(f"  currency_uuid: {row[4]}")
else:
    print("Payment NOT found in payments table")

conn2.close()
conn1.close()
