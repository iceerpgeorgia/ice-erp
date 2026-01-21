import psycopg2

# Direct connection string for Supabase (without pgbouncer params)
conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
conn = psycopg2.connect(conn_str)
cur = conn.cursor()

cur.execute("""
    SELECT ba.uuid, ba.account_number, c.code as currency, 
           ba.raw_table_name
    FROM bank_accounts ba
    LEFT JOIN currencies c ON ba.currency_uuid = c.uuid
    ORDER BY ba.account_number
""")

rows = cur.fetchall()

print('\n📊 Bank Accounts in Database:\n')
print(f"{'UUID':<40} {'Account':<20} {'Currency':<10} {'Raw Table':<30}")
print('='*100)

for row in rows:
    uuid, account, currency, raw_table = row
    print(f"{uuid:<40} {account:<20} {currency:<10} {raw_table or 'N/A':<30}")

cur.close()
conn.close()
