import psycopg2, psycopg2.extras
conn = psycopg2.connect(host='aws-1-eu-west-1.pooler.supabase.com',port=5432,dbname='postgres',user='postgres.fojbzghphznbslqwurrm',password='fulebimojviT1985%',sslmode='require')
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Find distinct insider_uuids from any table that has them
for tbl in ['rs_waybills_in_api', 'payments', 'projects', 'consolidated_bank_accounts']:
    try:
        cur.execute(f"SELECT DISTINCT insider_uuid FROM {tbl} WHERE insider_uuid IS NOT NULL LIMIT 5")
        rows = cur.fetchall()
        if rows:
            uuids = [r['insider_uuid'] for r in rows]
            print(f'{tbl}: {uuids}')
    except Exception as e:
        print(f'{tbl}: {e}')

conn.close()
