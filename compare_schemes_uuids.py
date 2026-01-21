import psycopg2

local_conn_str = "postgresql://postgres:fulebimojviT1985%25@localhost:5432/ICE_ERP"
supabase_conn_str = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

# Local
local = psycopg2.connect(local_conn_str)
lcur = local.cursor()
lcur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
local_schemes = lcur.fetchall()
print('LOCAL parsing_schemes:')
for row in local_schemes:
    print(f'  {row[0]:<15} {row[1]}')
local.close()

# Supabase
print()
supa = psycopg2.connect(supabase_conn_str)
scur = supa.cursor()
scur.execute('SELECT scheme, uuid FROM parsing_schemes ORDER BY scheme')
supa_schemes = scur.fetchall()
print('SUPABASE parsing_schemes:')
for row in supa_schemes:
    print(f'  {row[0]:<15} {row[1]}')
supa.close()

# Compare
print('\n' + '='*60)
if local_schemes == supa_schemes:
    print('✅ UUIDs MATCH')
else:
    print('❌ UUIDs DO NOT MATCH - need to sync parsing_schemes first!')
