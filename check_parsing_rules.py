#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check parsing rules in LOCAL database"""

import psycopg2
from urllib.parse import urlparse

with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('DATABASE_URL='):
            local_url = line.split('=', 1)[1].strip('"').strip("'")
            parsed = urlparse(local_url)
            clean_url = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
            
            local_conn = psycopg2.connect(clean_url)
            local_cur = local_conn.cursor()
            
            # Check parsing rules
            local_cur.execute('SELECT id, column_name, condition, counteragent_uuid, financial_code_uuid FROM parsing_scheme_rules')
            rules = local_cur.fetchall()
            
            print('📋 Parsing Scheme Rules in LOCAL DB:')
            print(f'   Total rules: {len(rules)}\n')
            for rule in rules:
                print(f'   Rule {rule[0]}:')
                print(f'      Match: {rule[1]}="{rule[2]}"')
                print(f'      → Counteragent: {rule[3][:8] if rule[3] else "None"}...')
                print(f'      → Financial Code: {rule[4][:8] if rule[4] else "None"}...')
                print()
            
            local_cur.close()
            local_conn.close()
            break
