#!/usr/bin/env python3
"""Import financial codes from financial_codes.xlsx"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv
import uuid as uuid_lib

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
# Remove schema parameter (Prisma-specific) for psycopg2
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

def get_parent_code(code):
    """Get parent code from hierarchical code (e.g., '1.2.3' -> '1.2')"""
    if '.' not in code:
        return None
    return code.rsplit('.', 1)[0]

def main():
    print("Reading financial_codes.xlsx...")
    df = pd.read_excel('financial_codes.xlsx')
    
    print(f"Columns: {df.columns.tolist()}")
    print(f"Found {len(df)} rows\n")
    
    # Check for duplicates BEFORE connecting to database
    print("Checking for duplicate codes...")
    duplicates = df[df.duplicated('code', keep=False)].sort_values('code')
    if len(duplicates) > 0:
        print("\n✗ ERROR: Found duplicate codes in Excel file:")
        print(duplicates[['code', 'name']].to_string())
        print("\nPlease fix the Excel file and try again.")
        return
    print("✓ No duplicates found\n")
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Truncate table
        print("Truncating financial_codes table...")
        cur.execute('TRUNCATE TABLE financial_codes CASCADE')
        conn.commit()
        print("✓ Table truncated\n")
        
        # Build code to UUID mapping for sort_order calculation
        code_to_uuid = {}
        records = []
        
        for idx, row in df.iterrows():
            code = str(row['code']).strip()
            if not code or pd.isna(code):
                continue
            
            # UUID already in Excel
            record_uuid = str(row['uuid']).strip()
            code_to_uuid[code] = record_uuid
            
            # Extract fields
            name = str(row['name']).strip()
            is_income = bool(row['is_income'])
            applies_to_pl = bool(row['applies_to_pl'])
            applies_to_cf = bool(row['applies_to_cf'])
            
            # parent_uuid from Excel (may be NaN for root nodes)
            parent_uuid = str(row['parent_uuid']).strip() if pd.notna(row['parent_uuid']) else None
            
            depth = len(code.split('.'))
            income_indicator = " (+) " if is_income else " (-) "
            validation = f"{code}.{income_indicator}{name}"
            
            records.append({
                'code': code,
                'uuid': record_uuid,
                'name': name,
                'is_income': is_income,
                'applies_to_pl': applies_to_pl,
                'applies_to_cf': applies_to_cf,
                'parent_uuid': parent_uuid,
                'depth': depth,
                'validation': validation,
            })
        
        print(f"Processed {len(records)} valid records\n")
        
        # Sort by depth and code to ensure parents before children
        records.sort(key=lambda x: (x['depth'], x['code']))
        
        # Insert records
        print("Inserting records...")
        for i, record in enumerate(records, 1):
            # Calculate sort_order based on siblings with special handling for "0" prefix
            # and integer-based sorting (0.10 comes after 0.9)
            parent_uuid = record['parent_uuid']
            siblings = [r for r in records if r.get('parent_uuid') == parent_uuid]
            
            # Custom sort: codes starting with "0" come after "9"
            # and numeric parts are compared as integers
            def sort_key(r):
                code = r['code']
                # If starts with "0", treat as coming after "9" by prepending "~"
                if code.startswith('0'):
                    prefix = '~'
                else:
                    prefix = ''
                
                # Split by dots and pad each part as integer for proper sorting
                # "0.9" -> [0, 9] and "0.10" -> [0, 10], so 0.10 comes after 0.9
                parts = code.split('.')
                int_parts = tuple(int(p) if p.isdigit() else 0 for p in parts)
                return (prefix, int_parts)
            
            siblings.sort(key=sort_key)
            sort_order = next((idx + 1 for idx, r in enumerate(siblings) if r['code'] == record['code']), 1)
            
            cur.execute("""
                INSERT INTO financial_codes (
                    uuid, code, name, validation, is_income, applies_to_pl, applies_to_cf,
                    parent_uuid, depth, sort_order, is_active
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true
                )
            """, (
                record['uuid'], record['code'], record['name'], record['validation'],
                record['is_income'], record['applies_to_pl'], record['applies_to_cf'],
                record['parent_uuid'], record['depth'], sort_order
            ))
            
            if i % 50 == 0:
                print(f"  {i}/{len(records)}...")
        
        conn.commit()
        print(f"\n✓ Successfully imported {len(records)} financial codes\n")
        
        # Verify
        cur.execute('SELECT COUNT(*) FROM financial_codes')
        count = cur.fetchone()[0]
        print(f"Verification: {count} records in database\n")
        
        # Show sample
        print("Sample hierarchy:")
        cur.execute("""
            SELECT c.code, c.name, p.code as parent_code, c.depth
            FROM financial_codes c
            LEFT JOIN financial_codes p ON c.parent_uuid = p.uuid
            ORDER BY c.depth, c.sort_order, c.code
            LIMIT 15
        """)
        for row in cur.fetchall():
            indent = "  " * (row[3] - 1)
            parent = f" (parent: {row[2]})" if row[2] else ""
            print(f"  {indent}{row[0]} - {row[1]}{parent}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
