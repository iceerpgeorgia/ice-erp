#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Copy parsing_scheme_rules from Supabase to Local database
"""

import psycopg2
from urllib.parse import urlparse

# Read .env.local
remote_url = None
local_url = None
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('REMOTE_DATABASE_URL='):
            remote_url = line.split('=', 1)[1].strip('"').strip("'")
        elif line.startswith('DATABASE_URL='):
            local_url = line.split('=', 1)[1].strip('"').strip("'")

# Parse URLs
parsed_remote = urlparse(remote_url)
clean_remote = f'{parsed_remote.scheme}://{parsed_remote.netloc}{parsed_remote.path}'
parsed_local = urlparse(local_url)
clean_local = f'{parsed_local.scheme}://{parsed_local.netloc}{parsed_local.path}'

# Connect to both databases
remote_conn = psycopg2.connect(clean_remote)
local_conn = psycopg2.connect(clean_local)

remote_cur = remote_conn.cursor()
local_cur = local_conn.cursor()

# Get parsing rules from Supabase
remote_cur.execute('''
    SELECT id, scheme_uuid, column_name, condition, 
           counteragent_uuid, financial_code_uuid, nominal_currency_uuid
    FROM parsing_scheme_rules
''')
rules = remote_cur.fetchall()
print(f'📥 Found {len(rules)} parsing rules in Supabase')

# Copy to local database
copied = 0
for rule in rules:
    try:
        local_cur.execute('''
            INSERT INTO parsing_scheme_rules 
            (id, scheme_uuid, column_name, condition, counteragent_uuid, financial_code_uuid, nominal_currency_uuid)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                scheme_uuid = EXCLUDED.scheme_uuid,
                column_name = EXCLUDED.column_name,
                condition = EXCLUDED.condition,
                counteragent_uuid = EXCLUDED.counteragent_uuid,
                financial_code_uuid = EXCLUDED.financial_code_uuid,
                nominal_currency_uuid = EXCLUDED.nominal_currency_uuid
        ''', rule)
        copied += 1
        print(f'  ✓ Rule {rule[0]}: {rule[2]}={rule[3]}')
    except Exception as e:
        print(f'❌ Error copying rule {rule[0]}: {e}')

local_conn.commit()
print(f'✅ Copied {copied} parsing rules to local database')

remote_cur.close()
local_cur.close()
remote_conn.close()
local_conn.close()
