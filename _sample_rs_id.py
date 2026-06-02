import os, re
from dotenv import load_dotenv
import psycopg2

load_dotenv(".env")
url = os.environ["DIRECT_URL"]
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+?)(?:\?.*)?$', url)
user, pw, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
pw = pw.replace('%25', '%')
conn = psycopg2.connect(host=host, port=int(port), dbname=db, user=user, password=pw, sslmode='require')
cur = conn.cursor()
cur.execute("SELECT rs_id, waybill_no, shipping_address FROM rs_waybills_in_api WHERE shipping_address IS NOT NULL LIMIT 5")
for r in cur.fetchall():
    print(r)
conn.close()
