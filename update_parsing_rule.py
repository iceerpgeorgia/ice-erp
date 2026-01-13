from import_bank_xml_data import get_db_connections

conn1, conn2 = get_db_connections()
cur = conn2.cursor()
cur.execute("UPDATE parsing_scheme_rules SET payment_id = '004a5f_33_942e49' WHERE column_name = 'DocProdGroup' AND condition = 'COM'")
conn2.commit()
print("✅ Updated parsing rule with payment_id")

# Verify
cur.execute("SELECT id, column_name, condition, payment_id FROM parsing_scheme_rules")
rules = cur.fetchall()
print("\nParsing Rules:")
for r in rules:
    print(f"  Rule {r[0]}: {r[1]}={r[2]} -> payment_id: {r[3]}")

# Check if payment exists
cur.execute("SELECT payment_id, counteragent_uuid, project_uuid, financial_code_uuid, currency_uuid FROM payments WHERE payment_id = '004a5f_33_942e49'")
payment = cur.fetchone()
if payment:
    print(f"\n✅ Payment found:")
    print(f"  payment_id: {payment[0]}")
    print(f"  counteragent_uuid: {payment[1]}")
    print(f"  project_uuid: {payment[2]}")
    print(f"  financial_code_uuid: {payment[3]}")
    print(f"  currency_uuid: {payment[4]}")
else:
    print("\n⚠️ Payment NOT found")

conn2.close()
conn1.close()
