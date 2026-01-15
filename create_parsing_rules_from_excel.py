"""
Create parsing rules from Excel file with counteragent matches.
Reads the "Rules To Create" sheet and inserts rules into parsing_scheme_rules table.
"""
import pandas as pd
import psycopg2
from dotenv import load_dotenv
import os
import sys

# Set UTF-8 encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load environment variables
load_dotenv()

# Import the formula compiler
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lib'))
from formula_compiler import compile_formula

def main():
    print("="*80)
    print("CREATE PARSING RULES FROM EXCEL")
    print("="*80)
    
    # Read Excel file
    print("\n📂 Reading counteragent_identification_matched.xlsx...")
    try:
        df = pd.read_excel('counteragent_identification_matched.xlsx', sheet_name='Rules To Create')
        print(f"   ✅ Loaded {len(df)} rules from 'Rules To Create' sheet")
    except Exception as e:
        print(f"   ❌ Error reading Excel: {e}")
        sys.exit(1)
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("   ❌ DATABASE_URL not found in environment")
        sys.exit(1)
    
    # Remove schema parameter from URL
    if '?schema=' in db_url:
        db_url = db_url.split('?schema=')[0]
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    print("   ✅ Connected successfully")
    
    # Process each rule
    print("\n🔄 Creating parsing rules...")
    print("-"*80)
    
    created = 0
    skipped = 0
    errors = 0
    
    for idx, row in df.iterrows():
        regex = row['Regex']
        counteragent_label = row['Matchedcountragentlabel']
        counteragent_uuid = row['Matchedcountragentuuid']
        formula = row['Rule to create']
        
        # Skip if missing data
        if pd.isna(formula) or pd.isna(counteragent_uuid):
            print(f"\n[{idx+1}/{len(df)}] ⚠️  Skipping '{regex}' - missing formula or UUID")
            skipped += 1
            continue
        
        print(f"\n[{idx+1}/{len(df)}] Processing: {regex}")
        print(f"   Formula: {formula}")
        print(f"   Counteragent: {counteragent_label}")
        print(f"   UUID: {counteragent_uuid}")
        
        try:
            # Compile the formula
            compiled_script = compile_formula(formula)
            if not compiled_script:
                print(f"   ❌ Failed to compile formula")
                errors += 1
                continue
            
            print(f"   ✅ Compiled: {compiled_script[:100]}...")
            
            # Check if rule already exists (by condition)
            cursor.execute("""
                SELECT id FROM parsing_scheme_rules 
                WHERE condition = %s
            """, (formula,))
            
            if cursor.fetchone():
                print(f"   ⚠️  Rule already exists, skipping")
                skipped += 1
                continue
            
            # Insert the rule (generate UUID for scheme - using a default)
            # Use first scheme UUID from bank_accounts or a placeholder
            cursor.execute("SELECT uuid FROM bank_accounts LIMIT 1")
            scheme_result = cursor.fetchone()
            scheme_uuid = scheme_result[0] if scheme_result else '00000000-0000-0000-0000-000000000000'
            
            cursor.execute("""
                INSERT INTO parsing_scheme_rules (
                    scheme_uuid,
                    condition,
                    condition_script,
                    counteragent_uuid
                ) VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (
                str(scheme_uuid),
                formula,
                compiled_script,
                counteragent_uuid
            ))
            
            rule_id = cursor.fetchone()[0]
            conn.commit()
            
            print(f"   ✅ Created rule ID: {rule_id}")
            created += 1
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            errors += 1
            conn.rollback()
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"✅ Rules created: {created}")
    print(f"⚠️  Rules skipped: {skipped}")
    print(f"❌ Errors: {errors}")
    print(f"📊 Total processed: {len(df)}")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
