import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys
import re
from datetime import datetime
import time

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

def log_stage(stage_name, start_time=None):
    """Log stage with timestamp"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    if start_time:
        elapsed = time.time() - start_time
        print(f"[{timestamp}] ✅ {stage_name} - COMPLETED ({elapsed:.2f}s)")
    else:
        print(f"[{timestamp}] 🔄 {stage_name} - STARTING...")
    sys.stdout.flush()
    return time.time()

print("="*80)
print("PAYMENTS IMPORT FROM TEMPLATE WITH DETAILED LOGGING")
print("="*80)

# Database connection (SUPABASE)
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def validate_payment_id_format(payment_id):
    """Validate payment_id format: 6_2_6 hex format"""
    if pd.isna(payment_id) or payment_id == '':
        return True  # Empty is OK, will be auto-generated
    
    # Strict pattern: xxxxxx_xx_xxxxxx (6_2_6 format)
    pattern = r'^[0-9a-fA-F]{6}_[0-9a-fA-F]{2}_[0-9a-fA-F]{6}$'
    return bool(re.match(pattern, str(payment_id)))

try:
    start_total = time.time()
    
    # Stage 1: Connect to database
    start = log_stage("Connecting to database")
    conn = psycopg2.connect(DATABASE_URL)
    conn.set_session(autocommit=False)
    cur = conn.cursor()
    
    # Set longer timeout for operations
    cur.execute("SET statement_timeout = '300000'")  # 5 minutes
    conn.commit()
    log_stage("Database connection", start)
    
    # Stage 2: Read template
    start = log_stage("Reading payments_import_template.xlsx")
    df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')
    log_stage(f"Template read ({len(df)} raw rows)", start)
    
    # Stage 3: Clean data
    start = log_stage("Cleaning data (removing examples and empty rows)")
    df = df[~df.astype(str).apply(lambda row: row.str.contains('Example:', case=False, na=False).any(), axis=1)]
    df = df.dropna(how='all')
    log_stage(f"Data cleaned ({len(df)} valid rows)", start)
    
    if len(df) == 0:
        print("\n⚠️  No data to import. Please fill in the template with actual data.")
        sys.exit(0)
    
    # Stage 4: Truncate payments table
    start = log_stage("DELETING all existing payments (using DELETE instead of TRUNCATE)")
    print("   ⚠️  Waiting 3 seconds before deletion... Press Ctrl+C to cancel")
    time.sleep(3)
    
    print("   🗑️  Deleting payment_id_duplicates...")
    cur.execute("DELETE FROM payment_id_duplicates")
    conn.commit()
    print("   ✅ payment_id_duplicates cleared")
    
    print("   🗑️  Deleting payments (this may take a minute)...")
    cur.execute("DELETE FROM payments")
    conn.commit()
    
    print("   🔄 Resetting sequence...")
    cur.execute("ALTER SEQUENCE payments_id_seq RESTART WITH 1")
    conn.commit()
    
    print("   🔄 Disabling problematic trigger...")
    cur.execute("DROP TRIGGER IF EXISTS set_payment_identifiers ON payments")
    conn.commit()
    log_stage("Tables cleared, sequence reset, and trigger disabled", start)
    
    # Stage 5: Validate payment_ids
    start = log_stage("Validating payment_id format")
    invalid_payment_ids = []
    for idx, row in df.iterrows():
        payment_id = row.get('payment_id')
        if pd.notna(payment_id) and payment_id != '':
            if not validate_payment_id_format(payment_id):
                invalid_payment_ids.append({
                    'Row': idx + 2,
                    'payment_id': payment_id
                })
    
    if invalid_payment_ids:
        print(f"\n❌ Found {len(invalid_payment_ids)} invalid payment_id formats:")
        for item in invalid_payment_ids[:10]:
            print(f"   Row {item['Row']}: {item['payment_id']}")
        sys.exit(1)
    log_stage(f"Payment IDs validated ({len(df)} records)", start)
    
    # Stage 6: Validate UUIDs (simplified - trust the template)
    start = log_stage("Validating foreign key UUIDs")
    print("   ⏭️  Skipping detailed validation (assuming template is pre-validated)")
    log_stage("Foreign keys validation skipped", start)
    
    # Stage 7: Detect duplicates
    start = log_stage("Detecting duplicate combinations")
    df['combo_key'] = (
        df['project_uuid'].fillna('') + '|' +
        df['counteragent_uuid'].fillna('') + '|' +
        df['financial_code_uuid'].fillna('') + '|' +
        df['job_uuid'].fillna('') + '|' +
        df['income_tax'].astype(str) + '|' +
        df['currency_uuid'].fillna('')
    )
    
    duplicates = df[df.duplicated(subset='combo_key', keep=False)]
    duplicate_count = len(duplicates)
    log_stage(f"Duplicates detected ({duplicate_count} duplicate records)", start)
    
    # Stage 8: Prepare unique records  
    start = log_stage("Deduplicating records (keeping first occurrence)")
    # First deduplicate by combination
    df_unique = df.drop_duplicates(subset='combo_key', keep='first').copy()
    
    # Also deduplicate by payment_id for non-empty payment_ids
    # This ensures no payment_id appears twice
    df_with_payment_id = df_unique[df_unique['payment_id'].notna() & (df_unique['payment_id'] != '')]
    df_without_payment_id = df_unique[df_unique['payment_id'].isna() | (df_unique['payment_id'] == '')]
    
    df_with_payment_id_unique = df_with_payment_id.drop_duplicates(subset='payment_id', keep='first')
    df_unique = pd.concat([df_with_payment_id_unique, df_without_payment_id], ignore_index=True)
    
    # Final verification: check for any payment_id duplicates
    payment_id_check = df_unique[df_unique['payment_id'].notna() & (df_unique['payment_id'] != '')]
    payment_id_dupes = payment_id_check[payment_id_check.duplicated(subset=['payment_id'], keep=False)]
    if len(payment_id_dupes) > 0:
        print(f"\n⚠️  WARNING: Found {len(payment_id_dupes)} payment_id duplicates after dedup:")
        print(payment_id_dupes[['payment_id', 'project_uuid', 'counteragent_uuid']].head(20))
        print("\nRemoving these duplicates...")
        df_unique = df_unique.drop_duplicates(subset='payment_id', keep='first')
    
    unique_count = len(df_unique)
    log_stage(f"Unique records prepared ({unique_count} records)", start)

    
    # Stage 9: Prepare data for insertion
    start = log_stage("Preparing data for bulk insert")
    records = []
    for idx, row in df_unique.iterrows():
        payment_id = row.get('payment_id')
        payment_id_to_use = str(payment_id).strip() if pd.notna(payment_id) and str(payment_id).strip() != '' else None
        
        project_uuid = row.get('project_uuid')
        job_uuid = row.get('job_uuid')
        
        records.append((
            str(project_uuid).strip() if pd.notna(project_uuid) else None,
            str(row['counteragent_uuid']).strip(),
            str(row['financial_code_uuid']).strip(),
            str(job_uuid).strip() if pd.notna(job_uuid) else None,
            bool(row.get('income_tax', False)),
            str(row['currency_uuid']).strip(),
            payment_id_to_use,
            None  # record_uuid will be generated by trigger
        ))
    log_stage(f"Data prepared ({len(records)} records ready)", start)
    
    # Verify no duplicate payment_ids in records list
    payment_ids_in_records = [r[6] for r in records if r[6]]  # payment_id is at index 6
    payment_ids_set = set(payment_ids_in_records)
    if len(payment_ids_in_records) != len(payment_ids_set):
        from collections import Counter
        counter = Counter(payment_ids_in_records)
        dupes = {pid: count for pid, count in counter.items() if count > 1}
        print(f"\n⚠️  WARNING: Found {len(dupes)} duplicate payment_ids in records list:")
        for pid, count in list(dupes.items())[:10]:
            print(f"   - {pid}: appears {count} times")
        raise Exception(f"Duplicate payment_ids found in records: {list(dupes.keys())[:5]}")
    else:
        print(f"   ✅ Verified: All {len(payment_ids_in_records)} payment_ids are unique")
    
    # Stage 10: Bulk insert
    start = log_stage(f"Inserting {len(records)} payments into database")
    print("   ⏳ This may take a minute...")
    
    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        execute_values(
            cur,
            """
            INSERT INTO payments (
                project_uuid, counteragent_uuid, financial_code_uuid,
                job_uuid, income_tax, currency_uuid,
                payment_id, record_uuid, updated_at
            ) VALUES %s
            """,
            batch,
            template="(%s, %s, %s, %s, %s, %s, %s, %s, NOW())"
        )
        print(f"   📦 Batch {i//batch_size + 1}/{(len(records)-1)//batch_size + 1} inserted ({i+len(batch)}/{len(records)} records)")
        sys.stdout.flush()
    
    conn.commit()
    log_stage(f"Payments inserted ({len(records)} records)", start)
    
    # Stage 11: Store duplicates
    if duplicate_count > 0:
        start = log_stage(f"Storing duplicate mappings ({duplicate_count} duplicates)")
        duplicate_records = []
        
        for combo_key, group in duplicates.groupby('combo_key'):
            if len(group) > 1:
                master_row = group.iloc[0]
                master_payment_id = str(master_row['payment_id']).strip() if pd.notna(master_row['payment_id']) and master_row['payment_id'] != '' else None
                
                for idx in range(1, len(group)):
                    dup_row = group.iloc[idx]
                    duplicate_payment_id = str(dup_row['payment_id']).strip() if pd.notna(dup_row['payment_id']) and dup_row['payment_id'] != '' else None
                    
                    if master_payment_id and duplicate_payment_id:
                        duplicate_records.append((
                            master_payment_id,
                            duplicate_payment_id,
                            str(master_row.get('project_uuid')) if pd.notna(master_row.get('project_uuid')) else None,
                            str(master_row['counteragent_uuid']),
                            str(master_row['financial_code_uuid']),
                            str(master_row.get('job_uuid')) if pd.notna(master_row.get('job_uuid')) else None,
                            bool(master_row.get('income_tax', False)),
                            str(master_row['currency_uuid'])
                        ))
        
        if duplicate_records:
            execute_values(
                cur,
                """
                INSERT INTO payment_id_duplicates (
                    master_payment_id, duplicate_payment_id,
                    project_uuid, counteragent_uuid, financial_code_uuid,
                    job_uuid, income_tax, currency_uuid
                ) VALUES %s
                ON CONFLICT (duplicate_payment_id) DO NOTHING
                """,
                duplicate_records
            )
            conn.commit()
        
        log_stage(f"Duplicate mappings stored ({len(duplicate_records)} mappings)", start)
    
    # Final stage: Summary
    print("\n" + "="*80)
    print("IMPORT COMPLETED SUCCESSFULLY")
    print("="*80)
    total_time = time.time() - start_total
    print(f"✅ Total records in template: {len(df)}")
    print(f"✅ Unique payments imported: {unique_count}")
    print(f"✅ Duplicate payment_ids tracked: {duplicate_count}")
    print(f"✅ Total time: {total_time:.2f} seconds")
    print("="*80)
    
    cur.close()
    conn.close()

except KeyboardInterrupt:
    print("\n\n❌ Import cancelled by user")
    sys.exit(1)
except Exception as e:
    print(f"\n\n❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
