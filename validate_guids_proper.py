"""
Proper RS.GE WB_Items validation using GUID columns directly.
Validates GUIDs against database instead of trying to match names/codes.
"""

import openpyxl
from openpyxl import load_workbook
import json
import os
import urllib.parse
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

# Load environment variables
load_dotenv()

def parse_database_url(url):
    """Parse PostgreSQL connection URL."""
    try:
        url_decoded = urllib.parse.unquote(url)
        result = urllib.parse.urlparse(url_decoded)
        return {
            'host': result.hostname,
            'port': result.port or 5432,
            'user': result.username,
            'password': result.password,
            'database': result.path.lstrip('/')
        }
    except Exception as e:
        print(f"[ERROR] Error parsing DATABASE_URL: {e}")
        return None


def load_guids_from_xlsx(file_path):
    """Load GUID columns from XLSX."""
    print(f"\n[FILE] Loading GUID columns from: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"[ERROR] File not found: {file_path}")
        return None
    
    try:
        wb = load_workbook(file_path, data_only=True)
        ws = wb.active
        
        guid_data = []
        
        # Get header row to find GUID columns
        headers = []
        for cell in ws[1]:
            headers.append(cell.value)
        
        # Find GUID column indices
        guid_col_indices = {}
        for col_idx, header in enumerate(headers):
            if header == 'კონტრაგენტის GUID':
                guid_col_indices['counteragent'] = col_idx
            elif header == 'პროექტი GUID':
                guid_col_indices['project'] = col_idx
            elif header == 'საქონელი GUID':
                guid_col_indices['inventory'] = col_idx
            elif header == 'კოდის GUID':
                guid_col_indices['code'] = col_idx
        
        print(f"   Found GUID columns: {guid_col_indices}")
        
        # Extract all rows with any GUID
        for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if row_idx == 1:
                continue
            
            row_record = {
                'row_number': row_idx,
                'counteragent_guid': None,
                'project_guid': None,
                'inventory_guid': None,
                'code_guid': None
            }
            
            # Extract GUIDs
            if 'counteragent' in guid_col_indices and guid_col_indices['counteragent'] < len(row):
                val = row[guid_col_indices['counteragent']]
                if val and str(val).strip():
                    row_record['counteragent_guid'] = str(val).strip()
            
            if 'project' in guid_col_indices and guid_col_indices['project'] < len(row):
                val = row[guid_col_indices['project']]
                if val and str(val).strip():
                    row_record['project_guid'] = str(val).strip()
            
            if 'inventory' in guid_col_indices and guid_col_indices['inventory'] < len(row):
                val = row[guid_col_indices['inventory']]
                if val and str(val).strip():
                    row_record['inventory_guid'] = str(val).strip()
            
            if 'code' in guid_col_indices and guid_col_indices['code'] < len(row):
                val = row[guid_col_indices['code']]
                if val and str(val).strip():
                    row_record['code_guid'] = str(val).strip()
            
            # Only include if has at least one GUID
            if any([row_record[k] for k in ['counteragent_guid', 'project_guid', 'inventory_guid', 'code_guid']]):
                guid_data.append(row_record)
        
        print(f"   [OK] Extracted {len(guid_data)} rows with at least one GUID")
        return guid_data
    
    except Exception as e:
        print(f"[ERROR] Error loading XLSX: {e}")
        import traceback
        traceback.print_exc()
        return None


def fetch_database_dictionaries():
    """Fetch dictionaries as sets of UUIDs."""
    print("\n[DB] Fetching database dictionaries...")
    
    try:
        db_config = parse_database_url(os.getenv('DATABASE_URL'))
        if not db_config:
            return None
        
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get counteragents
        cur.execute('SELECT counteragent_uuid FROM counteragents WHERE is_active = TRUE')
        counteragent_uuids = set(row['counteragent_uuid'] for row in cur.fetchall())
        print(f"   Counteragents: {len(counteragent_uuids):,} active records")
        
        # Get projects (no status filter - all projects are valid)
        cur.execute('SELECT project_uuid FROM projects')
        project_uuids = set(row['project_uuid'] for row in cur.fetchall())
        print(f"   Projects: {len(project_uuids):,} records")
        
        # Get inventories
        cur.execute('SELECT uuid FROM inventories WHERE is_active = TRUE')
        inventory_uuids = set(row['uuid'] for row in cur.fetchall())
        print(f"   Inventories: {len(inventory_uuids):,} active records")
        
        # Get financial codes
        cur.execute('SELECT uuid FROM financial_codes WHERE is_active = TRUE')
        code_uuids = set(row['uuid'] for row in cur.fetchall())
        print(f"   Financial codes: {len(code_uuids):,} active records")
        
        cur.close()
        conn.close()
        
        return {
            'counteragents': counteragent_uuids,
            'projects': project_uuids,
            'inventories': inventory_uuids,
            'codes': code_uuids
        }
    
    except Exception as e:
        print(f"[ERROR] Error fetching dictionaries: {e}")
        import traceback
        traceback.print_exc()
        return None


def validate_guids(guid_data, db_dicts):
    """Validate all GUIDs against database."""
    print("\n[VALIDATION] Validating GUIDs against database...")
    
    issues = defaultdict(list)
    
    for row_record in guid_data:
        row_num = row_record['row_number']
        
        # Check counteragent GUID
        if row_record['counteragent_guid']:
            if row_record['counteragent_guid'].lower() not in {u.lower() for u in db_dicts['counteragents']}:
                issues['invalid_counteragent_guid'].append({
                    'row': row_num,
                    'guid': row_record['counteragent_guid']
                })
        
        # Check project GUID
        if row_record['project_guid']:
            if row_record['project_guid'].lower() not in {u.lower() for u in db_dicts['projects']}:
                issues['invalid_project_guid'].append({
                    'row': row_num,
                    'guid': row_record['project_guid']
                })
        
        # Check inventory GUID
        if row_record['inventory_guid']:
            if row_record['inventory_guid'].lower() not in {u.lower() for u in db_dicts['inventories']}:
                issues['invalid_inventory_guid'].append({
                    'row': row_num,
                    'guid': row_record['inventory_guid']
                })
        
        # Check code GUID
        if row_record['code_guid']:
            if row_record['code_guid'].lower() not in {u.lower() for u in db_dicts['codes']}:
                issues['invalid_code_guid'].append({
                    'row': row_num,
                    'guid': row_record['code_guid']
                })
    
    return issues


def generate_report(guid_data, issues):
    """Generate validation report."""
    print("\n[REPORT] Generating validation report...")
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_rows_with_guids': len(guid_data),
        'summary': {
            'invalid_counteragent_guid': len(issues.get('invalid_counteragent_guid', [])),
            'invalid_project_guid': len(issues.get('invalid_project_guid', [])),
            'invalid_inventory_guid': len(issues.get('invalid_inventory_guid', [])),
            'invalid_code_guid': len(issues.get('invalid_code_guid', []))
        },
        'issues': {
            'invalid_counteragent_guids': issues.get('invalid_counteragent_guid', [])[:100],
            'invalid_project_guids': issues.get('invalid_project_guid', [])[:100],
            'invalid_inventory_guids': issues.get('invalid_inventory_guid', [])[:100],
            'invalid_code_guids': issues.get('invalid_code_guid', [])[:100]
        }
    }
    
    # Save JSON report
    with open('waybill_guid_validation_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    # Print summary
    print("\n" + "="*80)
    print("VALIDATION SUMMARY")
    print("="*80)
    print(f"Total rows with GUIDs: {len(guid_data):,}")
    print(f"\nInvalid GUIDs found:")
    print(f"  Counteragent GUIDs: {report['summary']['invalid_counteragent_guid']:,}")
    print(f"  Project GUIDs: {report['summary']['invalid_project_guid']:,}")
    print(f"  Inventory GUIDs: {report['summary']['invalid_inventory_guid']:,}")
    print(f"  Code GUIDs: {report['summary']['invalid_code_guid']:,}")
    
    total_issues = sum(report['summary'].values())
    print(f"\nTotal issues: {total_issues:,}")
    print(f"Rows with issues: {len([i for i in issues.values() for _ in i]):,}")
    
    if total_issues == 0:
        print("\n✓ ALL GUIDS ARE VALID - Ready for sync!")
    else:
        print("\n⚠ INVALID GUIDS FOUND - Review report before syncing")
    
    print(f"\nReport saved: waybill_guid_validation_report.json")
    
    return report


def main():
    print("[START] RS.GE Waybill Items GUID Validation")
    
    # Load XLSX GUIDs
    file_path = r"D:\next-postgres-starter\Prompts\RS.GE - WB_Items_IN.xlsx"
    guid_data = load_guids_from_xlsx(file_path)
    if not guid_data:
        print("[ERROR] Failed to load XLSX")
        return
    
    # Fetch database dictionaries
    db_dicts = fetch_database_dictionaries()
    if not db_dicts:
        print("[ERROR] Failed to fetch database dictionaries")
        return
    
    # Validate GUIDs
    issues = validate_guids(guid_data, db_dicts)
    
    # Generate report
    report = generate_report(guid_data, issues)
    
    print("\n[COMPLETE]")


if __name__ == '__main__':
    main()
