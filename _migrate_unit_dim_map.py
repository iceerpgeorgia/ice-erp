#!/usr/bin/env python3
"""Migrate rs_unit_dimension_map: re-key by unit_text (from items) instead of rs_unit_id."""
import re, sys
import psycopg2

def load_env(path):
    env = {}
    try:
        for line in open(path, encoding='utf-8'):
            line = line.rstrip('\r\n').strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                val = v.strip().strip('"').strip("'").replace('\\r\\n', '').replace('\r', '').strip()
                env[k.strip()] = val
    except FileNotFoundError:
        pass
    return env

env = {}
for f in ['.env.local', '.env.production.local', '.env']:
    env.update(load_env(f))

DB_URL = env.get('DIRECT_DATABASE_URL', '') or re.sub(r'\?.*', '', env.get('DATABASE_URL', ''))
if not DB_URL:
    print('ERROR: No DB URL'); sys.exit(1)

conn = psycopg2.connect(DB_URL)
conn.autocommit = False
cur = conn.cursor()

steps = [
    "ALTER TABLE rs_unit_dimension_map DROP CONSTRAINT IF EXISTS rs_unit_dimension_map_rs_unit_id_key",
    "ALTER TABLE rs_unit_dimension_map ALTER COLUMN rs_unit_id DROP NOT NULL",
    "ALTER TABLE rs_unit_dimension_map ALTER COLUMN rs_unit_label DROP NOT NULL",
    "ALTER TABLE rs_unit_dimension_map ADD COLUMN IF NOT EXISTS unit_text TEXT",
    "TRUNCATE TABLE rs_unit_dimension_map RESTART IDENTITY CASCADE",
    """INSERT INTO rs_unit_dimension_map (unit_text, is_active, created_at, updated_at)
       SELECT DISTINCT unit, true, NOW(), NOW()
       FROM rs_waybills_in_items
       WHERE unit IS NOT NULL AND unit != ''
       ORDER BY unit""",
    "ALTER TABLE rs_unit_dimension_map ALTER COLUMN unit_text SET NOT NULL",
    "ALTER TABLE rs_unit_dimension_map ADD CONSTRAINT rs_unit_dimension_map_unit_text_key UNIQUE (unit_text)",
    "ALTER TABLE rs_unit_dimension_map DROP COLUMN IF EXISTS rs_unit_id",
    "ALTER TABLE rs_unit_dimension_map DROP COLUMN IF EXISTS rs_unit_label",
]

for step in steps:
    print(f'  > {step[:70]}...' if len(step) > 70 else f'  > {step}')
    cur.execute(step)

conn.commit()

cur.execute('SELECT count(*) FROM rs_unit_dimension_map')
print(f'\nRows inserted: {cur.fetchone()[0]}')
cur.execute('SELECT unit_text FROM rs_unit_dimension_map ORDER BY unit_text')
for (txt,) in cur.fetchall():
    print(f'  "{txt}"')

conn.close()
print('\nDone.')
