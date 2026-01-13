#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix parsing rules - split condition into column_name and condition"""

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
            
            print('🔧 Fixing parsing rules...\n')
            
            # Rule 1: docprodgroup="COM" → column_name='DocProdGroup', condition='COM'
            local_cur.execute('''
                UPDATE parsing_scheme_rules
                SET 
                    column_name = 'DocProdGroup',
                    condition = 'COM'
                WHERE id = 1
            ''')
            print('✅ Fixed Rule 1: DocProdGroup=COM')
            
            # Rule 2: docprodgroup="FEE" → column_name='DocProdGroup', condition='FEE'
            local_cur.execute('''
                UPDATE parsing_scheme_rules
                SET 
                    column_name = 'DocProdGroup',
                    condition = 'FEE'
                WHERE id = 2
            ''')
            print('✅ Fixed Rule 2: DocProdGroup=FEE')
            
            local_conn.commit()
            
            # Verify
            local_cur.execute('SELECT id, column_name, condition FROM parsing_scheme_rules')
            rules = local_cur.fetchall()
            
            print('\n📋 Updated Parsing Rules:')
            for rule in rules:
                print(f'   Rule {rule[0]}: {rule[1]}="{rule[2]}"')
            
            local_cur.close()
            local_conn.close()
            break
