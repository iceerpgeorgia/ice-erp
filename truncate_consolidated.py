#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Truncate consolidated_bank_accounts table"""

import psycopg2
from urllib.parse import urlparse

# Read .env.local
with open('.env.local', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('DATABASE_URL='):
            local_url = line.split('=', 1)[1].strip('"').strip("'")
            parsed = urlparse(local_url)
            clean_url = f'{parsed.scheme}://{parsed.netloc}{parsed.path}'
            
            local_conn = psycopg2.connect(clean_url)
            local_cur = local_conn.cursor()
            
            # Get count before truncate
            local_cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts')
            count = local_cur.fetchone()[0]
            print(f'📊 Current records in consolidated_bank_accounts: {count}')
            
            # Truncate
            print('🗑️  Truncating consolidated_bank_accounts...')
            local_cur.execute('TRUNCATE TABLE consolidated_bank_accounts')
            local_conn.commit()
            
            # Verify
            local_cur.execute('SELECT COUNT(*) FROM consolidated_bank_accounts')
            count = local_cur.fetchone()[0]
            print(f'✅ Table truncated. Current count: {count}')
            
            local_cur.close()
            local_conn.close()
            break
