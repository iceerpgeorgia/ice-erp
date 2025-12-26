#!/usr/bin/env python3
"""
Generate validation report for payments import template
Creates an Excel file with detailed information about all data quality issues
"""

import pandas as pd
import psycopg2
from datetime import datetime
import sys
import os

# Database connection (SUPABASE)
DB_CONFIG = {
    'host': 'aws-1-eu-west-1.pooler.supabase.com',
    'port': 6543,
    'database': 'postgres',
    'user': 'postgres.fojbzghphznbslqwurrm',
    'password': 'fulebimojviT1985%'
}

TEMPLATE_PATH = 'templates/payments_import_template.xlsx'
REPORT_PATH = f'templates/payments_validation_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

def validate_payment_id_format(payment_id):
    """Validate payment_id format (flexible hex_hex_hex)"""
    import re
    if pd.isna(payment_id) or payment_id == '':
        return True
    pattern = r'^[0-9a-fA-F]+_[0-9a-fA-F]+_[0-9a-fA-F]+$'
    return bool(re.match(pattern, str(payment_id)))

print("=" * 80)
print("PAYMENTS IMPORT VALIDATION REPORT GENERATOR")
print("=" * 80)

try:
    # Read the template
    print(f"\n📄 Reading {TEMPLATE_PATH}...")
    df = pd.read_excel(TEMPLATE_PATH)
    
    # Remove example rows and empty rows
    df = df[df['counteragent_uuid'].notna()]
    df = df[~df['counteragent_uuid'].astype(str).str.startswith('Example:', na=False)]
    df = df.reset_index(drop=True)
    
    print(f"   Found {len(df)} records to validate")
    
    # Add Excel row numbers (accounting for header)
    df['excel_row'] = df.index + 2
    
    # Connect to database
    print("\n🔌 Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Initialize report sheets
    report_data = {}
    
    # 1. INVALID PAYMENT IDs
    print("\n🔍 Checking payment_id formats...")
    invalid_payment_ids = []
    for idx, row in df.iterrows():
        payment_id = row.get('payment_id')
        if pd.notna(payment_id) and payment_id != '':
            if not validate_payment_id_format(payment_id):
                invalid_payment_ids.append({
                    'Excel Row': row['excel_row'],
                    'Payment ID': payment_id,
                    'Issue': 'Invalid format (must be hex_hex_hex)',
                    'Counteragent UUID': row.get('counteragent_uuid', ''),
                    'Financial Code UUID': row.get('financial_code_uuid', '')
                })
    
    if invalid_payment_ids:
        report_data['Invalid Payment IDs'] = pd.DataFrame(invalid_payment_ids)
        print(f"   Found {len(invalid_payment_ids)} invalid payment_id formats")
    else:
        print(f"   ✓ All payment_id formats valid")
    
    # 2. DUPLICATE PAYMENT IDs
    print("\n🔍 Checking for duplicate payment_ids...")
    provided_payment_ids = df[df['payment_id'].notna() & (df['payment_id'] != '')].copy()
    if len(provided_payment_ids) > 0:
        duplicate_ids = provided_payment_ids[provided_payment_ids['payment_id'].duplicated(keep=False)]
        if len(duplicate_ids) > 0:
            duplicate_report = duplicate_ids[['excel_row', 'payment_id', 'counteragent_uuid', 'financial_code_uuid']].copy()
            duplicate_report.columns = ['Excel Row', 'Payment ID', 'Counteragent UUID', 'Financial Code UUID']
            duplicate_report['Issue'] = 'Duplicate payment_id in template'
            report_data['Duplicate Payment IDs'] = duplicate_report
            print(f"   Found {len(duplicate_ids)} duplicate payment_ids")
        else:
            print(f"   ✓ No duplicate payment_ids")
    
    # 3. INVALID PROJECT UUIDs
    print("\n🔍 Checking project UUIDs...")
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
            invalid_project_rows = df[df['project_uuid'].notna() & 
                                     df['project_uuid'].astype(str).str.upper().isin(invalid_projects)].copy()
            invalid_project_report = invalid_project_rows[['excel_row', 'project_uuid', 'payment_id', 
                                                           'counteragent_uuid', 'financial_code_uuid']].copy()
            invalid_project_report.columns = ['Excel Row', 'Project UUID', 'Payment ID', 
                                              'Counteragent UUID', 'Financial Code UUID']
            invalid_project_report['Issue'] = 'Project UUID not found in database'
            report_data['Invalid Projects'] = invalid_project_report
            print(f"   Found {len(invalid_projects)} invalid project UUIDs affecting {len(invalid_project_rows)} rows")
        else:
            print(f"   ✓ All project UUIDs valid")
    
    # 4. INVALID COUNTERAGENT UUIDs
    print("\n🔍 Checking counteragent UUIDs...")
    counteragent_uuids = df['counteragent_uuid'].dropna().unique()
    counteragent_uuids_str = [str(uuid).strip().upper() for uuid in counteragent_uuids]
    cur.execute("""
        SELECT counteragent_uuid::text FROM counteragents 
        WHERE UPPER(counteragent_uuid::text) = ANY(%s)
    """, (counteragent_uuids_str,))
    valid_counteragents = {row[0].upper() for row in cur.fetchall()}
    invalid_counteragents = set(counteragent_uuids_str) - valid_counteragents
    
    if invalid_counteragents:
        invalid_counteragent_rows = df[df['counteragent_uuid'].astype(str).str.upper().isin(invalid_counteragents)].copy()
        invalid_counteragent_report = invalid_counteragent_rows[['excel_row', 'counteragent_uuid', 'payment_id', 
                                                                 'project_uuid', 'financial_code_uuid']].copy()
        invalid_counteragent_report.columns = ['Excel Row', 'Counteragent UUID', 'Payment ID', 
                                               'Project UUID', 'Financial Code UUID']
        invalid_counteragent_report['Issue'] = 'Counteragent UUID not found in database'
        report_data['Invalid Counteragents'] = invalid_counteragent_report
        print(f"   Found {len(invalid_counteragents)} invalid counteragent UUIDs affecting {len(invalid_counteragent_rows)} rows")
    else:
        print(f"   ✓ All counteragent UUIDs valid")
    
    # 5. INVALID FINANCIAL CODE UUIDs
    print("\n🔍 Checking financial code UUIDs...")
    financial_code_uuids = df['financial_code_uuid'].dropna().unique()
    financial_code_uuids_str = [str(uuid).strip().upper() for uuid in financial_code_uuids]
    cur.execute("""
        SELECT uuid::text FROM financial_codes 
        WHERE UPPER(uuid::text) = ANY(%s)
    """, (financial_code_uuids_str,))
    valid_financial_codes = {row[0].upper() for row in cur.fetchall()}
    invalid_financial_codes = set(financial_code_uuids_str) - valid_financial_codes
    
    if invalid_financial_codes:
        invalid_fc_rows = df[df['financial_code_uuid'].astype(str).str.upper().isin(invalid_financial_codes)].copy()
        invalid_fc_report = invalid_fc_rows[['excel_row', 'financial_code_uuid', 'payment_id', 
                                            'project_uuid', 'counteragent_uuid']].copy()
        invalid_fc_report.columns = ['Excel Row', 'Financial Code UUID', 'Payment ID', 
                                     'Project UUID', 'Counteragent UUID']
        invalid_fc_report['Issue'] = 'Financial Code UUID not found in database'
        report_data['Invalid Financial Codes'] = invalid_fc_report
        print(f"   Found {len(invalid_financial_codes)} invalid financial code UUIDs affecting {len(invalid_fc_rows)} rows")
    else:
        print(f"   ✓ All financial code UUIDs valid")
    
    # 6. INVALID JOB UUIDs
    print("\n🔍 Checking job UUIDs...")
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
            invalid_job_rows = df[df['job_uuid'].notna() & 
                                 df['job_uuid'].astype(str).str.upper().isin(invalid_jobs)].copy()
            invalid_job_report = invalid_job_rows[['excel_row', 'job_uuid', 'payment_id', 
                                                   'project_uuid', 'counteragent_uuid']].copy()
            invalid_job_report.columns = ['Excel Row', 'Job UUID', 'Payment ID', 
                                          'Project UUID', 'Counteragent UUID']
            invalid_job_report['Issue'] = 'Job UUID not found in database'
            report_data['Invalid Jobs'] = invalid_job_report
            print(f"   Found {len(invalid_jobs)} invalid job UUIDs affecting {len(invalid_job_rows)} rows")
        else:
            print(f"   ✓ All job UUIDs valid")
    
    # 7. INVALID CURRENCY UUIDs
    print("\n🔍 Checking currency UUIDs...")
    currency_uuids = df['currency_uuid'].dropna().unique()
    currency_uuids_str = [str(uuid).strip().upper() for uuid in currency_uuids]
    cur.execute("""
        SELECT uuid::text FROM currencies 
        WHERE UPPER(uuid::text) = ANY(%s)
    """, (currency_uuids_str,))
    valid_currencies = {row[0].upper() for row in cur.fetchall()}
    invalid_currencies = set(currency_uuids_str) - valid_currencies
    
    if invalid_currencies:
        invalid_currency_rows = df[df['currency_uuid'].astype(str).str.upper().isin(invalid_currencies)].copy()
        invalid_currency_report = invalid_currency_rows[['excel_row', 'currency_uuid', 'payment_id', 
                                                         'project_uuid', 'counteragent_uuid']].copy()
        invalid_currency_report.columns = ['Excel Row', 'Currency UUID', 'Payment ID', 
                                           'Project UUID', 'Counteragent UUID']
        invalid_currency_report['Issue'] = 'Currency UUID not found in database'
        report_data['Invalid Currencies'] = invalid_currency_report
        print(f"   Found {len(invalid_currencies)} invalid currency UUIDs affecting {len(invalid_currency_rows)} rows")
    else:
        print(f"   ✓ All currency UUIDs valid")
    
    # 8. PROJECT-JOB MISMATCHES
    print("\n🔍 Checking project-job relationships...")
    rows_with_both = df[(df['project_uuid'].notna()) & (df['job_uuid'].notna())].copy()
    if len(rows_with_both) > 0:
        mismatched_rows = []
        for idx, row in rows_with_both.iterrows():
            cur.execute("""
                SELECT 1 FROM jobs j
                JOIN projects p ON j.project_uuid = p.project_uuid
                WHERE UPPER(j.job_uuid::text) = %s 
                AND UPPER(p.project_uuid::text) = %s
            """, (str(row['job_uuid']).strip().upper(), str(row['project_uuid']).strip().upper()))
            
            if cur.fetchone() is None:
                mismatched_rows.append({
                    'Excel Row': row['excel_row'],
                    'Project UUID': row['project_uuid'],
                    'Job UUID': row['job_uuid'],
                    'Payment ID': row.get('payment_id', ''),
                    'Counteragent UUID': row['counteragent_uuid'],
                    'Issue': 'Job does not belong to the selected project'
                })
        
        if mismatched_rows:
            report_data['Project-Job Mismatches'] = pd.DataFrame(mismatched_rows)
            print(f"   Found {len(mismatched_rows)} project-job mismatches")
        else:
            print(f"   ✓ All project-job relationships valid")
    
    # 9. DUPLICATE COMBINATIONS (6-field unique constraint)
    print("\n🔍 Checking for duplicate payment combinations...")
    df['combo_key'] = (
        df['project_uuid'].fillna('NULL').astype(str).str.upper() + '|' +
        df['counteragent_uuid'].astype(str).str.upper() + '|' +
        df['financial_code_uuid'].astype(str).str.upper() + '|' +
        df['job_uuid'].fillna('NULL').astype(str).str.upper() + '|' +
        df['income_tax'].astype(str) + '|' +
        df['currency_uuid'].astype(str).str.upper()
    )
    
    duplicate_combos = df[df['combo_key'].duplicated(keep=False)].copy()
    if len(duplicate_combos) > 0:
        duplicate_combos_report = duplicate_combos[['excel_row', 'payment_id', 'project_uuid', 
                                                    'counteragent_uuid', 'financial_code_uuid', 
                                                    'job_uuid', 'income_tax', 'currency_uuid']].copy()
        duplicate_combos_report.columns = ['Excel Row', 'Payment ID', 'Project UUID', 
                                           'Counteragent UUID', 'Financial Code UUID', 
                                           'Job UUID', 'Income Tax', 'Currency UUID']
        duplicate_combos_report['Issue'] = 'Duplicate 6-field combination (violates unique constraint)'
        duplicate_combos_report = duplicate_combos_report.sort_values('Excel Row')
        report_data['Duplicate Combinations'] = duplicate_combos_report
        print(f"   Found {len(duplicate_combos)} rows with duplicate combinations")
    else:
        print(f"   ✓ No duplicate combinations")
    
    # 10. SUMMARY SHEET
    summary_data = {
        'Issue Category': [],
        'Count': [],
        'Rows Affected': [],
        'Severity': []
    }
    
    for sheet_name, sheet_df in report_data.items():
        if sheet_name == 'Duplicate Payment IDs':
            summary_data['Issue Category'].append('Duplicate Payment IDs')
            summary_data['Count'].append(len(sheet_df))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('HIGH')
        elif sheet_name == 'Invalid Projects':
            summary_data['Issue Category'].append('Invalid Project UUIDs')
            summary_data['Count'].append(len(sheet_df['Project UUID'].unique()))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('HIGH')
        elif sheet_name == 'Invalid Counteragents':
            summary_data['Issue Category'].append('Invalid Counteragent UUIDs')
            summary_data['Count'].append(len(sheet_df['Counteragent UUID'].unique()))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('CRITICAL')
        elif sheet_name == 'Invalid Financial Codes':
            summary_data['Issue Category'].append('Invalid Financial Code UUIDs')
            summary_data['Count'].append(len(sheet_df['Financial Code UUID'].unique()))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('CRITICAL')
        elif sheet_name == 'Invalid Jobs':
            summary_data['Issue Category'].append('Invalid Job UUIDs')
            summary_data['Count'].append(len(sheet_df['Job UUID'].unique()))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('HIGH')
        elif sheet_name == 'Invalid Currencies':
            summary_data['Issue Category'].append('Invalid Currency UUIDs')
            summary_data['Count'].append(len(sheet_df['Currency UUID'].unique()))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('CRITICAL')
        elif sheet_name == 'Project-Job Mismatches':
            summary_data['Issue Category'].append('Project-Job Relationship Mismatches')
            summary_data['Count'].append(len(sheet_df))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('HIGH')
        elif sheet_name == 'Duplicate Combinations':
            summary_data['Issue Category'].append('Duplicate 6-Field Combinations')
            summary_data['Count'].append(len(sheet_df))
            summary_data['Rows Affected'].append(len(sheet_df))
            summary_data['Severity'].append('CRITICAL')
    
    # Add summary as first sheet
    summary_df = pd.DataFrame(summary_data)
    
    # Create report metadata
    metadata = pd.DataFrame({
        'Property': ['Report Generated', 'Template File', 'Total Records', 'Database', 'Issues Found'],
        'Value': [
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            TEMPLATE_PATH,
            len(df),
            f"{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}",
            len(report_data)
        ]
    })
    
    # Write report to Excel
    print(f"\n📊 Generating report: {REPORT_PATH}...")
    with pd.ExcelWriter(REPORT_PATH, engine='openpyxl') as writer:
        # Write metadata and summary first
        metadata.to_excel(writer, sheet_name='Report Info', index=False)
        if len(summary_df) > 0:
            summary_df.to_excel(writer, sheet_name='Summary', index=False)
        
        # Write all issue sheets
        for sheet_name, sheet_df in report_data.items():
            sheet_df.to_excel(writer, sheet_name=sheet_name, index=False)
            
            # Auto-adjust column widths
            worksheet = writer.sheets[sheet_name]
            for idx, col in enumerate(sheet_df.columns):
                max_length = max(
                    sheet_df[col].astype(str).apply(len).max(),
                    len(col)
                )
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 80)
    if len(report_data) > 0:
        print(f"❌ VALIDATION ISSUES FOUND")
        print(f"\n📄 Detailed report saved to: {REPORT_PATH}")
        print(f"\nIssue Summary:")
        for idx, row in summary_df.iterrows():
            print(f"   • {row['Issue Category']}: {row['Count']} ({row['Severity']})")
    else:
        print(f"✅ NO VALIDATION ISSUES FOUND")
        print(f"\n📄 Clean report saved to: {REPORT_PATH}")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ Error generating report: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
