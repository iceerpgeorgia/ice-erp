import os, re
from dotenv import load_dotenv
import psycopg2

load_dotenv(".env")
url = os.environ["DIRECT_URL"]
m = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(\S+?)(?:\?.*)?$', url)
user, pw, host, port, db = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5)
pw = pw.replace('%25', '%')
conn = psycopg2.connect(host=host, port=int(port), dbname=db, user=user, password=pw, sslmode='require')
conn.autocommit = True
cur = conn.cursor()

print("Enabling pg_trgm...")
cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
print("  Done.")

print("Creating GIN index on rs_waybills_in_api.shipping_address...")
cur.execute("""
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gin_waybill_shipping_address
    ON rs_waybills_in_api USING GIN (shipping_address gin_trgm_ops)
""")
print("  Done.")

conn.close()
print("All done.")
