import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise RuntimeError('DATABASE_URL not set')
if '?' in db_url:
    db_url = db_url.split('?')[0]

RAW_TABLE = 'bog_gel_raw_893486000'
CONS_TABLE = 'consolidated_bank_accounts'
NEW_TABLE = 'GE78BG0000000893486000_BOG_GEL'
SCHEMA = 'public'

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Fetch column definitions using format_type for accurate types
col_sql = """
  SELECT a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS data_type,
         a.attnotnull AS not_null
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = %s
    AND c.relname = %s
    AND a.attnum > 0
    AND NOT a.attisdropped
  ORDER BY a.attnum;
"""

cur.execute(col_sql, (SCHEMA, RAW_TABLE))
raw_cols = cur.fetchall()
cur.execute(col_sql, (SCHEMA, CONS_TABLE))
cons_cols = cur.fetchall()

raw_col_names = {name for name, _, _ in raw_cols}

# Build combined column list: raw first, then consolidated extras
combined_cols = list(raw_cols)
for name, data_type, not_null in cons_cols:
    if name in raw_col_names:
        continue
    combined_cols.append((name, data_type, not_null))

# Create table statement
columns_sql = []
for name, data_type, not_null in combined_cols:
    not_null_sql = " NOT NULL" if not_null else ""
    columns_sql.append(f'  "{name}" {data_type}{not_null_sql}')

create_sql = f'CREATE TABLE IF NOT EXISTS "{SCHEMA}"."{NEW_TABLE}" (\n' + ",\n".join(columns_sql) + '\n);'

print(f"Creating table {SCHEMA}.{NEW_TABLE} with {len(combined_cols)} columns...")
cur.execute(create_sql)
conn.commit()

print("Done.")

cur.close()
conn.close()
