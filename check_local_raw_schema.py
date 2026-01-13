#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check bog_gel_raw table schema in LOCAL database"""

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
            
            # Check bog_gel_raw table schema
            local_cur.execute('''
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'bog_gel_raw_893486000'
                ORDER BY ordinal_position
            ''')
            columns = local_cur.fetchall()
            
            print('📋 bog_gel_raw_893486000 columns in LOCAL:')
            for col in columns:
                print(f'  - {col[0]}')
            
            local_cur.close()
            local_conn.close()
            break
