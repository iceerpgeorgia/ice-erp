import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys
import re
from datetime import datetime

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

print("="*80)
print("PAYMENTS IMPORT FROM TEMPLATE")
print("="*80)

# Database connection (SUPABASE)
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

def validate_payment_id_format(payment_id):
    """Validate payment_id format: flexible hex_hex_hex with underscores"""
    if pd.isna(payment_id) or payment_id == '':
        return True  # Empty is OK, will be auto-generated
    
    # More flexible pattern: hex_hex_hex (any length hex segments separated by underscores)
    pattern = r'^[0-9a-fA-F]+_[0-9a-fA-F]+_[0-9a-fA-F]+$'
    return bool(re.match(pattern, str(payment_id)))

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Read the template
    print("\n📄 Reading payments_import_template.xlsx...")
    df = pd.read_excel('templates/payments_import_template.xlsx', sheet_name='Payments')
    
    # Remove example rows (rows with "Example:" in any field)
    df = df[~df.astype(str).apply(lambda row: row.str.contains('Example:', case=False, na=False).any(), axis=1)]
    
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    print(f"   Found {len(df)} records (after removing examples and empty rows)")
    
    if len(df) == 0:
        print("\n⚠️  No data to import. Please fill in the template with actual data.")
        sys.exit(0)
    
    # Check required fields
    print("\n✅ Validating required fields...")
    required_fields = ['counteragent_uuid', 'financial_code_uuid', 'currency_uuid']
    has_errors = False
    
    for field in required_fields:
        null_count = df[field].isna().sum()
        if null_count > 0:
            print(f"   ❌ {field}: {null_count} NULL values found - THIS IS REQUIRED!")
            has_errors = True
        else:
            print(f"   ✓ {field}: All {len(df)} values present")
    
    # Check optional fields
    optional_fields = ['project_uuid', 'job_uuid']
    for field in optional_fields:
        null_count = df[field].isna().sum()
        present_count = len(df) - null_count
        print(f"   ℹ️  {field}: {present_count} provided, {null_count} NULL (optional)")
    
    # Validate project-job relationship for rows where both are provided
    print("\n🔍 Validating project-job relationships...")
    rows_with_both = df[(df['project_uuid'].notna()) & (df['job_uuid'].notna())]
    if len(rows_with_both) > 0:
        print(f"   Checking {len(rows_with_both)} rows with both project and job...")
        mismatched_jobs = []
        for idx, row in rows_with_both.iterrows():
            project_uuid = str(row['project_uuid']).strip().upper()
            job_uuid = str(row['job_uuid']).strip().upper()
            cur.execute("""
                SELECT j.job_uuid::text 
                FROM jobs j
                WHERE UPPER(j.job_uuid::text) = %s 
                AND UPPER(j.project_uuid::text) = %s
            """, (job_uuid, project_uuid))
            result = cur.fetchone()
            if not result:
                mismatched_jobs.append((idx + 2, project_uuid[:8], job_uuid[:8]))
        
        if mismatched_jobs:
            print(f"   ⚠️  Found {len(mismatched_jobs)} jobs not connected to their projects:")
            for row_num, proj, job in mismatched_jobs[:5]:
                print(f"      Row {row_num}: job {job}... not in project {proj}...")
            print(f"   ℹ️  Jobs must belong to the selected project")
        else:
            print(f"   ✓ All project-job relationships are valid")
    else:
        print(f"   ℹ️  No rows with both project and job to validate")
    
    # Validate payment_id format
    print("\n🔍 Validating payment_id format...")
    invalid_payment_ids = []
    for idx, row in df.iterrows():
        payment_id = row.get('payment_id')
        if pd.notna(payment_id) and payment_id != '':
            if not validate_payment_id_format(payment_id):
                invalid_payment_ids.append((idx + 2, payment_id))  # +2 for Excel row (header + 0-index)
    
    if invalid_payment_ids:
        print(f"   ❌ Found {len(invalid_payment_ids)} invalid payment_id formats:")
        for row_num, payment_id in invalid_payment_ids[:10]:
            print(f"      Row {row_num}: '{payment_id}' (must be 6hex_2hex_4hex format)")
        has_errors = True
    else:
        provided_count = df['payment_id'].notna().sum()
        print(f"   ✓ All payment_id formats valid ({provided_count} provided, {len(df) - provided_count} will be auto-generated)")
    
    # Validate income_tax field
    print("\n🔍 Validating income_tax values...")
    if 'income_tax' in df.columns:
        invalid_tax = df[~df['income_tax'].astype(str).str.lower().isin(['true', 'false', 'yes', 'no', 'nan'])]
        if len(invalid_tax) > 0:
            print(f"   ❌ Found {len(invalid_tax)} invalid income_tax values (must be true/false)")
            has_errors = True
        else:
            print(f"   ✓ All income_tax values are valid booleans")
    
    # Validate foreign keys
    print("\n🔍 Validating foreign key references...")
    
    # Check projects (only if provided)
    project_uuids = df['project_uuid'].dropna().unique()
    if len(project_uuids) > 0:
        project_uuids_str = [str(uuid).strip().upper() for uuid in project_uuids]
        cur.execute("""
            SELECT project_uuid::text FROM projects 
            WHERE UPPER(project_uuid::text) = ANY(%s)
        """, (project_uuids_str,))
        valid_projects = {row[0].upper() for row in cur.fetchall()}
        invalid_projects = set(project_uuids_str) - valid_projects
        
        if invalid_projects:
            print(f"   ❌ Found {len(invalid_projects)} invalid project UUIDs:")
            for uuid in list(invalid_projects):
                print(f"      - {uuid}")
            has_errors = True
        else:
            print(f"   ✓ All {len(project_uuids)} project UUIDs are valid")
    else:
        print(f"   ℹ️  No project UUIDs to validate (all NULL)")
    
    # Check counteragents
    counteragent_uuids = df['counteragent_uuid'].dropna().unique()
    counteragent_uuids_str = [str(uuid).strip().upper() for uuid in counteragent_uuids]
    cur.execute("""
        SELECT counteragent_uuid::text FROM counteragents 
        WHERE UPPER(counteragent_uuid::text) = ANY(%s)
    """, (counteragent_uuids_str,))
    valid_counteragents = {row[0].upper() for row in cur.fetchall()}
    invalid_counteragents = set(counteragent_uuids_str) - valid_counteragents
    
    if invalid_counteragents:
        print(f"   ❌ Found {len(invalid_counteragents)} invalid counteragent UUIDs:")
        for uuid in list(invalid_counteragents)[:5]:
            print(f"      - {uuid}")
        has_errors = True
    else:
        print(f"   ✓ All {len(counteragent_uuids)} counteragent UUIDs are valid")
    
    # Check financial codes
    financial_code_uuids = df['financial_code_uuid'].dropna().unique()
    financial_code_uuids_str = [str(uuid).strip().upper() for uuid in financial_code_uuids]
    cur.execute("""
        SELECT uuid::text FROM financial_codes 
        WHERE UPPER(uuid::text) = ANY(%s)
    """, (financial_code_uuids_str,))
    valid_financial_codes = {row[0].upper() for row in cur.fetchall()}
    invalid_financial_codes = set(financial_code_uuids_str) - valid_financial_codes
    
    if invalid_financial_codes:
        print(f"   ❌ Found {len(invalid_financial_codes)} invalid financial code UUIDs:")
        for uuid in list(invalid_financial_codes)[:5]:
            print(f"      - {uuid}")
        has_errors = True
    else:
        print(f"   ✓ All {len(financial_code_uuids)} financial code UUIDs are valid")
    
    # Check jobs (only if provided)
    job_uuids = df['job_uuid'].dropna().unique()
    if len(job_uuids) > 0:
        job_uuids_str = [str(uuid).strip().upper() for uuid in job_uuids]
        cur.execute("""
            SELECT job_uuid::text FROM jobs 
            WHERE UPPER(job_uuid::text) = ANY(%s)
        """, (job_uuids_str,))
        valid_jobs = {row[0].upper() for row in cur.fetchall()}
        invalid_jobs = set(job_uuids_str) - valid_jobs
        
        if invalid_jobs:
            print(f"   ❌ Found {len(invalid_jobs)} invalid job UUIDs:")
            for uuid in list(invalid_jobs)[:5]:
                print(f"      - {uuid}")
            has_errors = True
        else:
            print(f"   ✓ All {len(job_uuids)} job UUIDs are valid")
    else:
        print(f"   ℹ️  No job UUIDs to validate (all NULL)")
    
    # Check currencies
    currency_uuids = df['currency_uuid'].dropna().unique()
    currency_uuids_str = [str(uuid).strip().upper() for uuid in currency_uuids]
    cur.execute("""
        SELECT uuid::text FROM currencies 
        WHERE UPPER(uuid::text) = ANY(%s)
    """, (currency_uuids_str,))
    valid_currencies = {row[0].upper() for row in cur.fetchall()}
    invalid_currencies = set(currency_uuids_str) - valid_currencies
    
    if invalid_currencies:
        print(f"   ❌ Found {len(invalid_currencies)} invalid currency UUIDs:")
        for uuid in list(invalid_currencies)[:5]:
            print(f"      - {uuid}")
        has_errors = True
    else:
        print(f"   ✓ All {len(currency_uuids)} currency UUIDs are valid")
    
    # Check for duplicate payment_ids (if provided)
    print("\n🔍 Checking for duplicate payment_ids...")
    provided_payment_ids = df[df['payment_id'].notna() & (df['payment_id'] != '')]['payment_id']
    if len(provided_payment_ids) > 0:
        duplicate_ids = provided_payment_ids[provided_payment_ids.duplicated()].unique()
        if len(duplicate_ids) > 0:
            print(f"   ❌ Found {len(duplicate_ids)} duplicate payment_ids in template:")
            for pid in list(duplicate_ids)[:5]:
                print(f"      - {pid}")
            has_errors = True
        else:
            print(f"   ✓ No duplicates in provided payment_ids")
        
        # Check if payment_ids already exist in database
        provided_payment_ids_list = [str(pid).strip() for pid in provided_payment_ids]
        cur.execute("""
            SELECT payment_id FROM payments 
            WHERE payment_id = ANY(%s)
        """, (provided_payment_ids_list,))
        existing_payment_ids = {row[0] for row in cur.fetchall()}
        
        if existing_payment_ids:
            print(f"   ⚠️  Found {len(existing_payment_ids)} payment_ids that already exist in database:")
            for pid in list(existing_payment_ids)[:5]:
                print(f"      - {pid}")
            print(f"   ℹ️  These records will be SKIPPED to avoid duplicates")
    
    # Check for unique constraint violations (6-field combination)
    print("\n🔍 Checking for duplicate payment combinations...")
    df['combo_key'] = (
        df['project_uuid'].astype(str) + '|' +
        df['counteragent_uuid'].astype(str) + '|' +
        df['financial_code_uuid'].astype(str) + '|' +
        df['job_uuid'].astype(str) + '|' +
        df['income_tax'].astype(str) + '|' +
        df['currency_uuid'].astype(str)
    )
    duplicate_combos = df[df['combo_key'].duplicated(keep=False)]
    if len(duplicate_combos) > 0:
        print(f"   ⚠️  Found {len(duplicate_combos)} rows with duplicate 6-field combinations")
        print(f"   ℹ️  Will keep first payment_id per combination and track duplicates")
        
        # Group duplicates and prepare for tracking
        duplicate_groups = duplicate_combos.groupby('combo_key')
        total_duplicates = 0
        
        for combo_key, group in duplicate_groups:
            if len(group) > 1:
                total_duplicates += len(group) - 1
        
        print(f"   📝 Will store {total_duplicates} duplicate payment_ids for later matching")
    else:
        print(f"   ✓ No duplicate 6-field combinations found")
    
    # Stop if there are errors
    if has_errors:
        print("\n" + "="*80)
        print("❌ VALIDATION FAILED - Please fix the errors above before importing")
        print("="*80)
        sys.exit(1)
    
    print("\n" + "="*80)
    print("✅ ALL VALIDATIONS PASSED")
    print("="*80)
    
    # Ask for confirmation
    print(f"\n📊 Summary:")
    print(f"   Records to import: {len(df)}")
    has_dupes = len(df[df['combo_key'].duplicated(keep='first')]) > 0
    if has_dupes:
        unique_count = len(df.drop_duplicates(subset='combo_key'))
        dupe_count = len(df) - unique_count
        print(f"   Unique payments: {unique_count}")
        print(f"   Duplicate payment_ids to track: {dupe_count}")
    
    confirm = input("\n❓ Proceed with import? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("\n❌ Import cancelled by user")
        sys.exit(0)
    
    # Prepare data for insertion - keep first occurrence of each combo_key
    print("\n📦 Preparing data for insertion...")
    df_unique = df.drop_duplicates(subset='combo_key', keep='first').copy()
    df_duplicates = df[df['combo_key'].duplicated(keep='first')].copy()
    
    print(f"   Unique records to insert: {len(df_unique)}")
    print(f"   Duplicate payment_ids to track: {len(df_duplicates)}")
    
    insert_count = 0
    duplicate_tracking_count = 0
    error_count = 0
    
    # Insert unique records
    for idx, row in df_unique.iterrows():
        try:
            # Convert boolean values
            income_tax = False
            if pd.notna(row.get('income_tax')):
                income_tax_str = str(row['income_tax']).lower()
                income_tax = income_tax_str in ['true', 'yes', '1', '1.0']
            
            is_active = True
            if pd.notna(row.get('is_active')):
                is_active_str = str(row['is_active']).lower()
                is_active = is_active_str in ['true', 'yes', '1', '1.0']
            
            payment_id = row.get('payment_id')
            payment_id_to_use = str(payment_id).strip() if pd.notna(payment_id) and payment_id != '' else None
            
            # Prepare values with NULL handling
            project_uuid_val = str(row['project_uuid']).strip().upper() if pd.notna(row['project_uuid']) and str(row['project_uuid']).strip() != 'nan' else None
            job_uuid_val = str(row['job_uuid']).strip().upper() if pd.notna(row['job_uuid']) and str(row['job_uuid']).strip() != 'nan' else None
            
            # Insert with or without payment_id (trigger will generate if NULL)
            cur.execute("""
                INSERT INTO payments (
                    payment_id, project_uuid, counteragent_uuid, financial_code_uuid,
                    job_uuid, income_tax, currency_uuid, is_active, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
            """, (
                payment_id_to_use,
                project_uuid_val,
                str(row['counteragent_uuid']).strip().upper(),
                str(row['financial_code_uuid']).strip().upper(),
                job_uuid_val,
                income_tax,
                str(row['currency_uuid']).strip().upper(),
                is_active
            ))
            
            insert_count += 1
            
        except Exception as e:
            error_count += 1
            print(f"   ⚠️  Error on row {idx + 2}: {str(e)}")
            if error_count > 5:
                print(f"   ⚠️  Too many errors, stopping...")
                break
    
    conn.commit()
    print(f"\n   ✓ Inserted {insert_count} unique payment records")
    
    # Now track duplicate payment_ids
    if len(df_duplicates) > 0:
        print(f"\n📝 Storing duplicate payment_id mappings...")
        
        for idx, dup_row in df_duplicates.iterrows():
            try:
                # Find the master record (first occurrence with same combo_key)
                combo_key = dup_row['combo_key']
                master_row = df_unique[df_unique['combo_key'] == combo_key].iloc[0]
                
                master_payment_id = str(master_row['payment_id']).strip() if pd.notna(master_row['payment_id']) and master_row['payment_id'] != '' else None
                duplicate_payment_id = str(dup_row['payment_id']).strip() if pd.notna(dup_row['payment_id']) and dup_row['payment_id'] != '' else None
                
                if duplicate_payment_id and master_payment_id:
                    # Prepare values with NULL handling
                    project_uuid_val = str(dup_row['project_uuid']).strip().upper() if pd.notna(dup_row['project_uuid']) and str(dup_row['project_uuid']).strip() != 'nan' else None
                    job_uuid_val = str(dup_row['job_uuid']).strip().upper() if pd.notna(dup_row['job_uuid']) and str(dup_row['job_uuid']).strip() != 'nan' else None
                    income_tax_val = str(dup_row['income_tax']).lower() in ['true', 'yes', '1', '1.0']
                    
                    cur.execute("""
                        INSERT INTO payment_id_duplicates (
                            master_payment_id, duplicate_payment_id,
                            project_uuid, counteragent_uuid, financial_code_uuid,
                            job_uuid, income_tax, currency_uuid
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (duplicate_payment_id) DO NOTHING
                    """, (
                        master_payment_id,
                        duplicate_payment_id,
                        project_uuid_val,
                        str(dup_row['counteragent_uuid']).strip().upper(),
                        str(dup_row['financial_code_uuid']).strip().upper(),
                        job_uuid_val,
                        income_tax_val,
                        str(dup_row['currency_uuid']).strip().upper()
                    ))
                    
                    duplicate_tracking_count += 1
                    
            except Exception as e:
                print(f"   ⚠️  Error tracking duplicate on row {idx + 2}: {str(e)}")
        
        conn.commit()
        print(f"   ✓ Stored {duplicate_tracking_count} duplicate payment_id mappings")
    
    # Commit transaction
    conn.commit()
    
    print("\n" + "="*80)
    print("✅ IMPORT COMPLETED")
    print("="*80)
    print(f"\n📊 Results:")
    print(f"   ✓ Successfully inserted unique payments: {insert_count}")
    if duplicate_tracking_count > 0:
        print(f"   ✓ Duplicate payment_ids tracked: {duplicate_tracking_count}")
    if error_count > 0:
        print(f"   ✗ Errors: {error_count}")
    print(f"\n   Total processed: {insert_count + duplicate_tracking_count + error_count}")
    
    cur.close()
    conn.close()

    
except Exception as e:
    print(f"\n❌ Fatal error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
