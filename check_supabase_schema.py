#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check consolidated_bank_accounts schema in Supabase"""

import psycopg2
from urllib.parse import urlparse

# Read .env.local
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('REMOTE_DATABASE_URL='):
            remote_url = line.split('=', 1)[1].strip('"').strip("'")
            parsed = urlparse(remote_url)
            clean_url = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
            
            remote_conn = psycopg2.connect(clean_url)
            remote_cur = remote_conn.cursor()
            
            # Check consolidated_bank_accounts schema
            remote_cur.execute('''
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'consolidated_bank_accounts'
                ORDER BY ordinal_position
            ''')
            columns = remote_cur.fetchall()
            
            print('📋 consolidated_bank_accounts columns in SUPABASE:')
            for col in columns:
                print(f'  - {col[0]} ({col[1]})')
            
            remote_cur.close()
            remote_conn.close()
            break
