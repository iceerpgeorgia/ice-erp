"""
Comprehensive validation of RS.GE WB_Items_IN.xlsx against database dictionaries.
Improved version using direct PostgreSQL connection and intelligent column/field matching.
"""

import openpyxl
from openpyxl import load_workbook
import json
import os
import re
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
        # Fix URL encoding
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
        print(f"❌ Error parsing DATABASE_URL: {e}")
        return None


def load_waybill_items_xlsx(file_path):
    """Load and parse the XLSX file with improved column detection."""
    print(f"\n[FILE] Loading XLSX file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"[ERROR] File not found: {file_path}")
        return None
    
    try:
        wb = load_workbook(file_path, data_only=True)  # Use data_only=True to get values, not formulas
        print(f"   Sheets found: {wb.sheetnames}")
        
        ws = wb.active
        print(f"   Active sheet: {ws.title}")
        
        # Extract headers - now with data_only=True, should get actual values where formulas exist
        rows_data = []
        headers = []
        header_row = None
        
        for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if row_idx == 1:
                # Filter out None values from headers
                for cell in row:
                    headers.append(cell)
                
                # Remove trailing None values
                while headers and headers[-1] is None:
                    headers.pop()
                
                print(f"   Headers: {len(headers)} columns")
                
                # Show actual column names
                for i, h in enumerate(headers[:15]):
                    print(f"     Col {i}: {h}")
                print(f"     ... (more columns)")
                
                header_row = 1
                continue
            
            # Skip empty rows
            if all(cell is None for cell in row):
                continue
            
            row_dict = {}
            for col_idx in range(len(headers)):
                if col_idx < len(row):
                    row_dict[col_idx] = row[col_idx]
            
            if row_dict and any(v is not None for v in row_dict.values()):
                rows_data.append(row_dict)
        
        print(f"   [OK] Loaded {len(rows_data)} data rows")
        return {
            'sheet': ws.title,
            'headers': headers,
            'data': rows_data
        }
    
    except Exception as e:
        print(f"[ERROR] Error loading XLSX: {e}")
        import traceback
        traceback.print_exc()
        return None


def fetch_database_dictionaries():
    """Fetch dictionaries directly from PostgreSQL."""
    print("\n[DB] Fetching database dictionaries...")
    
    try:
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("❌ DATABASE_URL not set in environment")
            return None
        
        db_config = parse_database_url(db_url)
        if not db_config:
            return None
        
        print(f"   Connecting to {db_config['host']}:{db_config['port']}/{db_config['database']}")
        
        conn = psycopg2.connect(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            database=db_config['database']
        )
        
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Fetch projects
        cur.execute(
            "SELECT project_uuid as uuid, project_name as name, contract_no as code FROM projects ORDER BY project_name"
        )
        projects = cur.fetchall()
        print(f"   [OK] Projects: {len(projects)} records")
        
        # Fetch financial codes (note: is_active = true means active, so is_deleted = NOT is_active)
        cur.execute(
            "SELECT uuid, code, name, (NOT COALESCE(is_active, true)) as is_deleted FROM financial_codes ORDER BY code"
        )
        financial_codes = cur.fetchall()
        active_fc = sum(1 for fc in financial_codes if not fc.get('is_deleted'))
        print(f"   [OK] Financial codes: {len(financial_codes)} records ({sum(1 for fc in financial_codes if not fc.get('is_deleted'))} active)")
        
        # Fetch inventories
        cur.execute(
            "SELECT uuid, name, internal_number as code, (NOT COALESCE(is_active, true)) as is_deleted FROM inventories ORDER BY internal_number"
        )
        inventories = cur.fetchall()
        active_inv = sum(1 for inv in inventories if not inv.get('is_deleted'))
        print(f"   [OK] Inventories: {len(inventories)} records ({active_inv} active)")
        
        conn.close()
        
        return {
            'projects': [dict(p) for p in projects],
            'financial_codes': [dict(fc) for fc in financial_codes],
            'inventories': [dict(inv) for inv in inventories]
        }
    
    except Exception as e:
        print(f"[ERROR] Error fetching database: {e}")
        import traceback
        traceback.print_exc()
        return None


def extract_inventory_code(inventory_value):
    """Extract code from composite inventory string (e.g., '07841 | N/A | დაუხარისხებელი - ცალი | ცალი | მეტალის გადამყვანი')."""
    if not inventory_value:
        return None
    
    value_str = str(inventory_value).strip()
    
    # Try to extract first part before | as code
    parts = value_str.split('|')
    if parts and parts[0].strip():
        code = parts[0].strip()
        # Check if it looks like a numeric code
        if re.match(r'^\d+$', code):
            return code
    
    # Try to extract code as first sequence of digits
    match = re.match(r'^(\d+)', value_str)
    if match:
        return match.group(1)
    
    return value_str  # Return full string as fallback


def extract_financial_code_prefix(fc_value):
    """Extract code from financial code string (e.g., '3.5.1. (-) საკანცელარიო ხარჯები' -> '3.5.1')."""
    if not fc_value:
        return None
    
    value_str = str(fc_value).strip()
    
    # Try to extract first part before any space or dash
    match = re.match(r'^([0-9_\.]+)', value_str)
    if match:
        return match.group(1)
    
    return value_str  # Return full string as fallback


def validate_data(waybill_data, db_dicts):
    """Perform comprehensive validation checks."""
    print("\n[CHECK] Performing validation checks...")
    
    if not waybill_data or not db_dicts:
        print("[ERROR] Missing data or database dictionaries")
        return None
    
    data = waybill_data['data']
    headers = waybill_data['headers']
    
    # Build lookup dictionaries
    project_by_code = {p.get('code'): p for p in db_dicts['projects'] if p.get('code')}
    project_by_name = {p.get('name', '').lower(): p for p in db_dicts['projects'] if p.get('name')}
    project_by_uuid = {p.get('uuid'): p for p in db_dicts['projects'] if p.get('uuid')}
    
    fc_by_code = {fc.get('code'): fc for fc in db_dicts['financial_codes'] if fc.get('code')}
    fc_by_name = {fc.get('name', '').lower(): fc for fc in db_dicts['financial_codes'] if fc.get('name')}
    fc_by_uuid = {fc.get('uuid'): fc for fc in db_dicts['financial_codes'] if fc.get('uuid')}
    
    inv_by_code = {inv.get('code'): inv for inv in db_dicts['inventories'] if inv.get('code')}
    inv_by_name = {inv.get('name', '').lower(): inv for inv in db_dicts['inventories'] if inv.get('name')}
    inv_by_uuid = {inv.get('uuid'): inv for inv in db_dicts['inventories'] if inv.get('uuid')}
    
    issues = {
        'missing_projects': [],
        'deleted_projects': [],
        'missing_financial_codes': [],
        'deleted_financial_codes': [],
        'missing_inventories': [],
        'deleted_inventories': [],
        'summary': {}
    }
    
    # Find relevant columns by name matching (Col 1 = პროექტი, Col 2 = კოდი, Col 5 = საქონელი)
    project_col_idx = None
    fc_col_idx = None
    inv_col_idx = None
    
    for idx, header in enumerate(headers):
        if header is None:
            continue
        
        header_str = str(header).lower()
        
        # Find project column (first one matching 'პროექტი')
        if project_col_idx is None and 'პროექტი' in header_str and 'guid' not in header_str:
            project_col_idx = idx
        
        # Find financial code column (first real column not formula with 'კოდი')
        if fc_col_idx is None and 'კოდი' in header_str and not str(header).startswith('='):
            fc_col_idx = idx
        
        # Find inventory column (first column with 'საქონელი' not desc or guid)
        if inv_col_idx is None and 'საქონელი' in header_str and 'guid' not in header_str and 'დასახელება' not in header_str:
            inv_col_idx = idx
    
    print(f"\n   Detected columns:")
    print(f"     Project column (idx {project_col_idx}): {headers[project_col_idx][:50] if project_col_idx and headers[project_col_idx] else 'Not found'}")
    print(f"     Financial Code column (idx {fc_col_idx}): {headers[fc_col_idx][:50] if fc_col_idx and headers[fc_col_idx] else 'Not found'}")
    print(f"     Inventory column (idx {inv_col_idx}): {headers[inv_col_idx][:50] if inv_col_idx and headers[inv_col_idx] else 'Not found'}")
    
    processed_count = 0
    
    for row_idx, row in enumerate(data, start=2):
        processed_count += 1
        
        # Check for completely empty rows
        if all(v is None or v == '' or v is False for v in row.values()):
            continue
        
        # Validate Project (Column 1: პროექტი)
        if project_col_idx is not None and project_col_idx in row:
            project_val = row[project_col_idx]
            if project_val and project_val is not True:  # Skip True values from formulas
                project_val_str = str(project_val).strip()
                
                # Try lookups
                found = False
                if project_val_str in project_by_uuid:
                    found = True
                    if project_by_uuid[project_val_str].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_uuid[project_val_str].get('name')
                        })
                elif project_val_str in project_by_code:
                    found = True
                    if project_by_code[project_val_str].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_code[project_val_str].get('name')
                        })
                elif project_val_str.lower() in project_by_name:
                    found = True
                    if project_by_name[project_val_str.lower()].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_name[project_val_str.lower()].get('name')
                        })
                
                if not found:
                    issues['missing_projects'].append({
                        'row': row_idx,
                        'value': project_val_str
                    })
        
        # Validate Financial Code (Column 2: კოდი)
        if fc_col_idx is not None and fc_col_idx in row:
            fc_val = row[fc_col_idx]
            if fc_val and fc_val is not True and fc_val is not False:
                fc_val_str = str(fc_val).strip()
                
                # Extract code prefix for matching
                fc_prefix = extract_financial_code_prefix(fc_val_str)
                
                # Try lookups
                found = False
                if fc_val_str in fc_by_uuid:
                    found = True
                    if fc_by_uuid[fc_val_str].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_uuid[fc_val_str].get('name')
                        })
                elif fc_val_str in fc_by_code:
                    found = True
                    if fc_by_code[fc_val_str].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_code[fc_val_str].get('name')
                        })
                elif fc_prefix and fc_prefix in fc_by_code:
                    found = True
                    if fc_by_code[fc_prefix].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_code[fc_prefix].get('name')
                        })
                elif fc_val_str.lower() in fc_by_name:
                    found = True
                    if fc_by_name[fc_val_str.lower()].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_name[fc_val_str.lower()].get('name')
                        })
                
                if not found:
                    issues['missing_financial_codes'].append({
                        'row': row_idx,
                        'value': fc_val_str
                    })
        
        # Validate Inventory (Column 5: საქონელი)
        if inv_col_idx is not None and inv_col_idx in row:
            inv_val = row[inv_col_idx]
            if inv_val and inv_val is not True and inv_val is not False:
                inv_val_str = str(inv_val).strip()
                
                # Extract code from composite string
                inv_code = extract_inventory_code(inv_val_str)
                
                # Try lookups
                found = False
                if inv_val_str in inv_by_uuid:
                    found = True
                    if inv_by_uuid[inv_val_str].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str[:80],
                            'name': inv_by_uuid[inv_val_str].get('name')
                        })
                elif inv_val_str in inv_by_code:
                    found = True
                    if inv_by_code[inv_val_str].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str[:80],
                            'name': inv_by_code[inv_val_str].get('name')
                        })
                elif inv_code and inv_code in inv_by_code:
                    found = True
                    if inv_by_code[inv_code].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_code,
                            'name': inv_by_code[inv_code].get('name')
                        })
                elif inv_val_str.lower() in inv_by_name:
                    found = True
                    if inv_by_name[inv_val_str.lower()].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str[:80],
                            'name': inv_by_name[inv_val_str.lower()].get('name')
                        })
                
                if not found:
                    issues['missing_inventories'].append({
                        'row': row_idx,
                        'value': inv_val_str[:100]  # Truncate for display
                    })
    
    # Build summary
    issues['summary'] = {
        'total_rows': processed_count,
        'missing_projects_count': len(issues['missing_projects']),
        'deleted_projects_count': len(issues['deleted_projects']),
        'missing_financial_codes_count': len(issues['missing_financial_codes']),
        'deleted_financial_codes_count': len(issues['deleted_financial_codes']),
        'missing_inventories_count': len(issues['missing_inventories']),
        'deleted_inventories_count': len(issues['deleted_inventories']),
        'total_issues': sum(len(v) for k, v in issues.items() if k != 'summary')
    }
    
    return issues


def generate_report(waybill_data, db_dicts, issues):
    """Generate a detailed validation report."""
    print("\n" + "="*80)
    print("VALIDATION REPORT - RS.GE WB_Items_IN.xlsx")
    print("="*80)
    print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if not issues:
        print("[ERROR] Validation failed to complete")
        return False
    
    summary = issues['summary']
    
    print(f"\n[SUMMARY]")
    print(f"  Total rows processed: {summary['total_rows']}")
    print(f"  Total issues found: {summary['total_issues']}")
    
    # Database dictionaries summary
    print(f"\n[DB_DICTS]")
    
    # For projects, there's no is_deleted field in the original model, so check if any have it
    active_projects = len([p for p in db_dicts['projects'] if not p.get('is_deleted', False)])
    deleted_projects = len([p for p in db_dicts['projects'] if p.get('is_deleted', False)])
    print(f"  Projects: {len(db_dicts['projects'])} records ({active_projects} active, {deleted_projects} deleted)")
    
    active_fc = len([fc for fc in db_dicts['financial_codes'] if not fc.get('is_deleted', False)])
    deleted_fc = len([fc for fc in db_dicts['financial_codes'] if fc.get('is_deleted', False)])
    print(f"  Active Financial Codes: {active_fc}")
    print(f"  Deleted Financial Codes: {deleted_fc}")
    
    active_inv = len([inv for inv in db_dicts['inventories'] if not inv.get('is_deleted', False)])
    deleted_inv = len([inv for inv in db_dicts['inventories'] if inv.get('is_deleted', False)])
    print(f"  Active Inventories: {active_inv}")
    print(f"  Deleted Inventories: {deleted_inv}")
    
    # Missing items
    print(f"\n[MISSING] MISSING ITEMS (not found in database):")
    if issues['missing_projects']:
        print(f"\n  Missing Projects ({len(issues['missing_projects'])}):")
        for item in issues['missing_projects'][:10]:
            print(f"    Row {item['row']}: '{item['value']}'")
        if len(issues['missing_projects']) > 10:
            print(f"    ... and {len(issues['missing_projects']) - 10} more")
    else:
        print(f"  [OK] No missing projects")
    else:
        print(f"  [OK] No missing financial codes")
    else:
        print(f"  [OK] No missing inventories")
    
    # Deleted items still referenced
    print(f"\n[WARNING] DELETED ITEMS (marked as deleted but still in XLSX):")
    if issues['deleted_projects']:
        print(f"\n  Deleted Projects ({len(issues['deleted_projects'])}):")
        for item in issues['deleted_projects'][:10]:
            print(f"    Row {item['row']}: '{item['value']}' (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_projects']) > 10:
            print(f"    ... and {len(issues['deleted_projects']) - 10} more")
    else:
        print(f"  [OK] No deleted projects referenced")
    
    if issues['deleted_financial_codes']:
        print(f"\n  Deleted Financial Codes ({len(issues['deleted_financial_codes'])}):") 
        for item in issues['deleted_financial_codes'][:10]:
            print(f"    Row {item['row']}: '{item['value']}'[:80] (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_financial_codes']) > 10:
            print(f"    ... and {len(issues['deleted_financial_codes']) - 10} more")
    else:
        print(f"  [OK] No deleted financial codes referenced")
    
    if issues['deleted_inventories']:
        print(f"\n  Deleted Inventories ({len(issues['deleted_inventories'])}):") 
        for item in issues['deleted_inventories'][:10]:
            print(f"    Row {item['row']}: '{item['value']}' (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_inventories']) > 10:
            print(f"    ... and {len(issues['deleted_inventories']) - 10} more")
    else:
        print(f"  [OK] No deleted inventories referenced")
    print("\n" + "="*80)
    
    # Save detailed report to JSON
    report_file = 'D:\\next-postgres-starter\\waybill_validation_report_detailed.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'summary': summary,
            'issues': {
                'missing_projects': issues['missing_projects'][:100],  # First 100
                'deleted_projects': issues['deleted_projects'][:100],
                'missing_financial_codes': issues['missing_financial_codes'][:100],
                'deleted_financial_codes': issues['deleted_financial_codes'][:100],
                'missing_inventories': issues['missing_inventories'][:100],
                'deleted_inventories': issues['deleted_inventories'][:100]
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n[REPORT] Detailed report saved to: {report_file}")
    
    return summary['total_issues'] == 0


def main():
    """Main execution."""
    file_path = 'D:\\next-postgres-starter\\Prompts\\RS.GE - WB_Items_IN.xlsx'
    
    # Load XLSX
    waybill_data = load_waybill_items_xlsx(file_path)
    if not waybill_data:
        return
    
    # Fetch database dictionaries
    db_dicts = fetch_database_dictionaries()
    if not db_dicts:
        return
    
    # Validate
    issues = validate_data(waybill_data, db_dicts)
    if not issues:
        return
    
    # Generate report
    all_clean = generate_report(waybill_data, db_dicts, issues)
    
    if all_clean:
        print("\n✅ All validations passed! No issues found.")
    else:
        print("\n⚠️  Issues found. Review the report above and detailed JSON file.")


if __name__ == "__main__":
    main()
