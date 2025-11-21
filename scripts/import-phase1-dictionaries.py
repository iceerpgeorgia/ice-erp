#!/usr/bin/env python3
"""Import Phase 1 dictionaries from DICT_USERS.xlsx"""

import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

def import_currencies(cur):
    """Import Currencies from DICT_USERS.xlsx"""
    print("\n📝 Importing Currencies...")
    df = pd.read_excel('DICT_USERS.xlsx', sheet_name='Currencies')
    
    # Truncate
    cur.execute('TRUNCATE TABLE currencies CASCADE')
    
    imported = 0
    for idx, row in df.iterrows():
        if pd.isna(row['ვალუტა//']):
            continue
        
        code = str(row['ვალუტა//']).strip()
        uuid_val = str(row['ვალუტა GUID/']).strip() if pd.notna(row['ვალუტა GUID/']) else None
        
        cur.execute("""
            INSERT INTO currencies (uuid, code, name, is_active)
            VALUES (%s, %s, %s, true)
        """, (uuid_val, code, code))
        imported += 1
    
    print(f"  ✓ Imported {imported} currencies")
    return imported

def import_document_types(cur):
    """Import Document Types from DICT_USERS.xlsx"""
    print("\n📝 Importing Document Types...")
    df = pd.read_excel('DICT_USERS.xlsx', sheet_name='Document_Types')
    
    # Truncate
    cur.execute('TRUNCATE TABLE document_types CASCADE')
    
    imported = 0
    for idx, row in df.iterrows():
        if pd.isna(row['საბუთის ტიპი//']):
            continue
        
        name = str(row['საბუთის ტიპი//']).strip()
        uuid_val = str(row['Doc_Type_GUID/']).strip() if pd.notna(row['Doc_Type_GUID/']) else None
        
        cur.execute("""
            INSERT INTO document_types (uuid, name, is_active)
            VALUES (%s, %s, true)
        """, (uuid_val, name))
        imported += 1
    
    print(f"  ✓ Imported {imported} document types")
    return imported

def import_project_states(cur):
    """Import Project States from DICT_USERS.xlsx"""
    print("\n📝 Importing Project States...")
    df = pd.read_excel('DICT_USERS.xlsx', sheet_name='Project_States')
    
    # Truncate
    cur.execute('TRUNCATE TABLE project_states CASCADE')
    
    imported = 0
    for idx, row in df.iterrows():
        if pd.isna(row['პროექტის სტატუსი//']):
            continue
        
        name = str(row['პროექტის სტატუსი//']).strip()
        uuid_val = str(row['პროექტის სტატუსი_GUID/']).strip() if pd.notna(row['პროექტის სტატუსი_GUID/']) else None
        
        cur.execute("""
            INSERT INTO project_states (uuid, name, is_active)
            VALUES (%s, %s, true)
        """, (uuid_val, name))
        imported += 1
    
    print(f"  ✓ Imported {imported} project states")
    return imported

def import_mi_dimensions(cur):
    """Import MI Dimensions (Units) from DICT_USERS.xlsx"""
    print("\n📝 Importing MI Dimensions (Units of Measurement)...")
    df = pd.read_excel('DICT_USERS.xlsx', sheet_name='MI_Dimensions')
    
    # Truncate
    cur.execute('TRUNCATE TABLE mi_dimensions CASCADE')
    
    imported = 0
    seen_uuids = set()
    seen_names = set()
    for idx, row in df.iterrows():
        if pd.isna(row['ზომის ერთეული//']):
            continue
        
        name = str(row['ზომის ერთეული//']).strip()
        uuid_val = str(row['ზომის ერთეული_GUID/']).strip() if pd.notna(row['ზომის ერთეული_GUID/']) else None
        
        # Skip duplicate UUIDs
        if uuid_val and uuid_val in seen_uuids:
            print(f"  ⚠️  Skipping duplicate UUID: {name}")
            continue
        if uuid_val:
            seen_uuids.add(uuid_val)
        
        # Skip duplicate names
        if name in seen_names:
            print(f"  ⚠️  Skipping duplicate name: {name}")
            continue
        seen_names.add(name)
        
        cur.execute("""
            INSERT INTO mi_dimensions (uuid, name, is_active)
            VALUES (%s, %s, true)
        """, (uuid_val, name))
        imported += 1
    
    print(f"  ✓ Imported {imported} MI dimensions")
    return imported

def main():
    print("=" * 80)
    print("Importing Phase 1 Dictionaries from DICT_USERS.xlsx")
    print("=" * 80)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        total = 0
        total += import_currencies(cur)
        total += import_document_types(cur)
        total += import_project_states(cur)
        total += import_mi_dimensions(cur)
        
        conn.commit()
        
        print()
        print("=" * 80)
        print(f"✓ Successfully imported {total} total records")
        print("=" * 80)
        
        # Verification
        print("\nVerification:")
        cur.execute("SELECT COUNT(*) FROM currencies")
        print(f"  Currencies: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM document_types")
        print(f"  Document Types: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM project_states")
        print(f"  Project States: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM mi_dimensions")
        print(f"  MI Dimensions: {cur.fetchone()[0]}")
        
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
