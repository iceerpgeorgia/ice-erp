import psycopg2
import os
import re
from dotenv import load_dotenv
import urllib.parse

load_dotenv()

# Parse DATABASE_URL using the same method as validate_guids_final.py
db_url = os.getenv('DATABASE_URL')
url_decoded = urllib.parse.unquote(db_url)
parsed = urllib.parse.urlparse(url_decoded)
host = parsed.hostname
port = parsed.port or 5432
user = parsed.username
password = parsed.password
dbname = parsed.path.lstrip('/')

try:
    conn = psycopg2.connect(host=host, port=port, database=dbname, user=user, password=password)
    cur = conn.cursor()
    
    # Check what insider_uuid values exist
    print('Checking rs_waybills_in_items...')
    cur.execute('SELECT COUNT(*), COUNT(DISTINCT insider_uuid) FROM rs_waybills_in_items')
    count_total, count_distinct = cur.fetchone()
    print(f'  Total rows: {count_total}')
    print(f'  Distinct insider_uuid: {count_distinct}')
    
    if count_total > 0:
        cur.execute('SELECT DISTINCT insider_uuid FROM rs_waybills_in_items LIMIT 10')
        for row in cur.fetchall():
            print(f'    {row[0]}')
    
    # Check if there's a projects or users table we can get insider_uuid from
    print('\nChecking projects table...')
    cur.execute('SELECT COUNT(*), COUNT(DISTINCT insider_uuid) FROM projects WHERE insider_uuid IS NOT NULL')
    result = cur.fetchone()
    if result:
        print(f'  Total with insider_uuid: {result[0]}')
        print(f'  Distinct insider_uuid: {result[1]}')
        
        if result[0] > 0:
            cur.execute('SELECT DISTINCT insider_uuid FROM projects WHERE insider_uuid IS NOT NULL LIMIT 5')
            for row in cur.fetchall():
                print(f'    {row[0]}')
    
    cur.close()
    conn.close()
except Exception as e:
    print(f'Error: {e}')
