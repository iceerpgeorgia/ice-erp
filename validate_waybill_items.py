"""
Comprehensive validation of RS.GE WB_Items_IN.xlsx against database dictionaries.
Checks for mismatches in projects, financial codes, and inventories.
"""

import openpyxl
from openpyxl import load_workbook
import json
import os
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv
import requests
import base64

# Load environment variables
load_dotenv()

def load_waybill_items_xlsx(file_path):
    """Load and parse the XLSX file."""
    print(f"\n📂 Loading XLSX file: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None
    
    try:
        wb = load_workbook(file_path)
        print(f"   Sheets found: {wb.sheetnames}")
        
        # Try to find the data sheet (usually first sheet)
        ws = wb.active
        print(f"   Active sheet: {ws.title}")
        
        # Extract headers and data
        rows_data = []
        headers = []
        
        for row_idx, row in enumerate(ws.iter_rows(values_only=True), start=1):
            if row_idx == 1:
                # Filter out formula objects and None values from headers
                for cell in row:
                    if cell is not None:
                        # Convert formula objects to string representation
                        cell_str = str(cell) if not isinstance(cell, (str, int, float)) else cell
                        headers.append(cell_str)
                    else:
                        headers.append(None)
                
                # Remove trailing None values from headers
                while headers and headers[-1] is None:
                    headers.pop()
                
                print(f"   Headers: {len(headers)} columns")
                for i, h in enumerate(headers):
                    print(f"     Col {i}: {h[:80] if isinstance(h, str) else h}")
                continue
            
            # Skip empty rows
            if all(cell is None for cell in row):
                continue
            
            row_dict = {}
            for col_idx in range(len(headers)):
                if col_idx < len(row):
                    row_dict[col_idx] = row[col_idx]
            
            if row_dict:  # Only add if not empty
                rows_data.append(row_dict)
        
        print(f"   ✓ Loaded {len(rows_data)} data rows")
        return {
            'sheet': ws.title,
            'headers': headers,
            'data': rows_data
        }
    
    except Exception as e:
        print(f"❌ Error loading XLSX: {e}")
        import traceback
        traceback.print_exc()
        return None


def fetch_database_dictionaries():
    """Fetch projects, financial codes, and inventories from Supabase."""
    print("\n🔍 Fetching database dictionaries...")
    
    try:
        supabase_url = os.getenv('SUPABASE_URL') or os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        
        if not supabase_url or not supabase_key:
            print("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment")
            return None
        
        print(f"   Connecting to Supabase...")
        
        headers = {
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json',
            'apikey': supabase_key,
        }
        
        # Fetch projects
        response_projects = requests.post(
            f'{supabase_url}/rest/v1/rpc/get_projects_for_validation',
            headers=headers,
            json={}
        )
        
        # If RPC doesn't exist, try direct table query
        if response_projects.status_code != 200:
            print(f"   RPC not available, using direct table query...")
            response_projects = requests.get(
                f'{supabase_url}/rest/v1/projects?select=uuid,name,code,is_deleted',
                headers=headers
            )
        
        if response_projects.status_code == 200:
            projects = response_projects.json()
            print(f"   ✓ Projects: {len(projects)} records")
        else:
            print(f"   ⚠️  Could not fetch projects: {response_projects.status_code}")
            projects = []
        
        # Fetch financial codes
        response_fc = requests.get(
            f'{supabase_url}/rest/v1/financial_codes?select=uuid,code,name,is_deleted',
            headers=headers
        )
        
        if response_fc.status_code == 200:
            financial_codes = response_fc.json()
            print(f"   ✓ Financial codes: {len(financial_codes)} records")
        else:
            print(f"   ⚠️  Could not fetch financial codes: {response_fc.status_code}")
            financial_codes = []
        
        # Fetch inventories
        response_inv = requests.get(
            f'{supabase_url}/rest/v1/inventories?select=uuid,name,code,is_deleted',
            headers=headers
        )
        
        if response_inv.status_code == 200:
            inventories = response_inv.json()
            print(f"   ✓ Inventories: {len(inventories)} records")
        else:
            print(f"   ⚠️  Could not fetch inventories: {response_inv.status_code}")
            inventories = []
        
        return {
            'projects': projects,
            'financial_codes': financial_codes,
            'inventories': inventories
        }
    
    except Exception as e:
        print(f"❌ Error fetching database: {e}")
        import traceback
        traceback.print_exc()
        return None


def validate_data(waybill_data, db_dicts):
    """Perform comprehensive validation checks."""
    print("\n🔎 Performing validation checks...")
    
    if not waybill_data or not db_dicts:
        print("❌ Missing data or database dictionaries")
        return None
    
    data = waybill_data['data']
    headers = waybill_data['headers']
    
    # Build lookup dictionaries for faster checking
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
        'invalid_rows': [],
        'summary': {}
    }
    
    # Detect column indices for Project, Financial Code, and Inventory
    # Look at Georgian column names
    project_col_idx = None
    fc_col_idx = None
    inv_col_idx = None
    
    for idx, header in enumerate(headers):
        if header is None:
            continue
        header_str = str(header).lower()
        
        if 'პროექტი' in header_str or 'project' in header_str:
            if 'guid' not in header_str:
                project_col_idx = idx
        
        if 'კოდი' in header_str or 'code' in header_str or 'financial' in header_str:
            if 'guid' not in header_str and fc_col_idx is None:
                fc_col_idx = idx
        
        if 'საქონელი' in header_str or 'inventory' in header_str or 'item' in header_str:
            if 'guid' not in header_str and 'დასახელება' not in header_str:
                inv_col_idx = idx
    
    print(f"\n   Detected column indices:")
    print(f"     Project column (idx {project_col_idx}): {headers[project_col_idx] if project_col_idx else 'Not found'}")
    print(f"     Financial Code column (idx {fc_col_idx}): {headers[fc_col_idx] if fc_col_idx else 'Not found'}")
    print(f"     Inventory column (idx {inv_col_idx}): {headers[inv_col_idx] if inv_col_idx else 'Not found'}")
    
    processed_count = 0
    
    for row_idx, row in enumerate(data, start=2):  # Start from row 2 (row 1 is headers)
        processed_count += 1
        
        # Check for completely empty rows
        if all(v is None or v == '' for v in row.values()):
            continue
        
        # Validate Project
        if project_col_idx is not None and project_col_idx in row:
            project_val = row[project_col_idx]
            if project_val:
                project_val_str = str(project_val).strip()
                
                # Try UUID lookup first
                if project_val_str in project_by_uuid:
                    if project_by_uuid[project_val_str].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_uuid[project_val_str].get('name')
                        })
                # Try code lookup
                elif project_val_str in project_by_code:
                    if project_by_code[project_val_str].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_code[project_val_str].get('name')
                        })
                # Try name lookup
                elif project_val_str.lower() in project_by_name:
                    if project_by_name[project_val_str.lower()].get('is_deleted'):
                        issues['deleted_projects'].append({
                            'row': row_idx,
                            'value': project_val_str,
                            'name': project_by_name[project_val_str.lower()].get('name')
                        })
                else:
                    # Not found at all
                    issues['missing_projects'].append({
                        'row': row_idx,
                        'value': project_val_str
                    })
        
        # Validate Financial Code
        if fc_col_idx is not None and fc_col_idx in row:
            fc_val = row[fc_col_idx]
            if fc_val:
                fc_val_str = str(fc_val).strip()
                
                # Try UUID lookup first
                if fc_val_str in fc_by_uuid:
                    if fc_by_uuid[fc_val_str].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_uuid[fc_val_str].get('name')
                        })
                # Try code lookup
                elif fc_val_str in fc_by_code:
                    if fc_by_code[fc_val_str].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_code[fc_val_str].get('name')
                        })
                # Try name lookup
                elif fc_val_str.lower() in fc_by_name:
                    if fc_by_name[fc_val_str.lower()].get('is_deleted'):
                        issues['deleted_financial_codes'].append({
                            'row': row_idx,
                            'value': fc_val_str,
                            'name': fc_by_name[fc_val_str.lower()].get('name')
                        })
                else:
                    issues['missing_financial_codes'].append({
                        'row': row_idx,
                        'value': fc_val_str
                    })
        
        # Validate Inventory
        if inv_col_idx is not None and inv_col_idx in row:
            inv_val = row[inv_col_idx]
            if inv_val:
                inv_val_str = str(inv_val).strip()
                
                # Try UUID lookup first
                if inv_val_str in inv_by_uuid:
                    if inv_by_uuid[inv_val_str].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str,
                            'name': inv_by_uuid[inv_val_str].get('name')
                        })
                # Try code lookup
                elif inv_val_str in inv_by_code:
                    if inv_by_code[inv_val_str].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str,
                            'name': inv_by_code[inv_val_str].get('name')
                        })
                # Try name lookup
                elif inv_val_str.lower() in inv_by_name:
                    if inv_by_name[inv_val_str.lower()].get('is_deleted'):
                        issues['deleted_inventories'].append({
                            'row': row_idx,
                            'value': inv_val_str,
                            'name': inv_by_name[inv_val_str.lower()].get('name')
                        })
                else:
                    issues['missing_inventories'].append({
                        'row': row_idx,
                        'value': inv_val_str
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
        print("❌ Validation failed to complete")
        return
    
    summary = issues['summary']
    
    print(f"\n📊 SUMMARY:")
    print(f"  Total rows processed: {summary['total_rows']}")
    print(f"  Total issues found: {summary['total_issues']}")
    
    # Database dictionaries summary
    print(f"\n📚 DATABASE DICTIONARIES:")
    print(f"  Active Projects: {len([p for p in db_dicts['projects'] if not p['is_deleted']])}")
    print(f"  Deleted Projects: {len([p for p in db_dicts['projects'] if p['is_deleted']])}")
    print(f"  Active Financial Codes: {len([fc for fc in db_dicts['financial_codes'] if not fc['is_deleted']])}")
    print(f"  Deleted Financial Codes: {len([fc for fc in db_dicts['financial_codes'] if fc['is_deleted']])}")
    print(f"  Active Inventories: {len([inv for inv in db_dicts['inventories'] if not inv['is_deleted']])}")
    print(f"  Deleted Inventories: {len([inv for inv in db_dicts['inventories'] if inv['is_deleted']])}")
    
    # Missing items
    print(f"\n❌ MISSING ITEMS (not found in database):")
    if issues['missing_projects']:
        print(f"\n  Missing Projects ({len(issues['missing_projects'])}):")
        for item in issues['missing_projects'][:10]:  # Show first 10
            print(f"    Row {item['row']}: '{item['value']}'")
        if len(issues['missing_projects']) > 10:
            print(f"    ... and {len(issues['missing_projects']) - 10} more")
    else:
        print(f"  ✓ No missing projects")
    
    if issues['missing_financial_codes']:
        print(f"\n  Missing Financial Codes ({len(issues['missing_financial_codes'])}):")
        for item in issues['missing_financial_codes'][:10]:
            print(f"    Row {item['row']}: '{item['value']}'")
        if len(issues['missing_financial_codes']) > 10:
            print(f"    ... and {len(issues['missing_financial_codes']) - 10} more")
    else:
        print(f"  ✓ No missing financial codes")
    
    if issues['missing_inventories']:
        print(f"\n  Missing Inventories ({len(issues['missing_inventories'])}):")
        for item in issues['missing_inventories'][:10]:
            print(f"    Row {item['row']}: '{item['value']}'")
        if len(issues['missing_inventories']) > 10:
            print(f"    ... and {len(issues['missing_inventories']) - 10} more")
    else:
        print(f"  ✓ No missing inventories")
    
    # Deleted items still referenced
    print(f"\n⚠️  DELETED ITEMS (marked as deleted but still in XLSX):")
    if issues['deleted_projects']:
        print(f"\n  Deleted Projects ({len(issues['deleted_projects'])}):")
        for item in issues['deleted_projects'][:10]:
            print(f"    Row {item['row']}: '{item['value']}' (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_projects']) > 10:
            print(f"    ... and {len(issues['deleted_projects']) - 10} more")
    else:
        print(f"  ✓ No deleted projects referenced")
    
    if issues['deleted_financial_codes']:
        print(f"\n  Deleted Financial Codes ({len(issues['deleted_financial_codes'])}):")
        for item in issues['deleted_financial_codes'][:10]:
            print(f"    Row {item['row']}: '{item['value']}' (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_financial_codes']) > 10:
            print(f"    ... and {len(issues['deleted_financial_codes']) - 10} more")
    else:
        print(f"  ✓ No deleted financial codes referenced")
    
    if issues['deleted_inventories']:
        print(f"\n  Deleted Inventories ({len(issues['deleted_inventories'])}):")
        for item in issues['deleted_inventories'][:10]:
            print(f"    Row {item['row']}: '{item['value']}' (Name: {item.get('name', 'N/A')})")
        if len(issues['deleted_inventories']) > 10:
            print(f"    ... and {len(issues['deleted_inventories']) - 10} more")
    else:
        print(f"  ✓ No deleted inventories referenced")
    
    print("\n" + "="*80)
    
    # Save detailed report to JSON
    report_file = 'D:\\next-postgres-starter\\waybill_validation_report.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'summary': summary,
            'issues': {
                'missing_projects': issues['missing_projects'],
                'deleted_projects': issues['deleted_projects'],
                'missing_financial_codes': issues['missing_financial_codes'],
                'deleted_financial_codes': issues['deleted_financial_codes'],
                'missing_inventories': issues['missing_inventories'],
                'deleted_inventories': issues['deleted_inventories']
            }
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n📄 Detailed report saved to: {report_file}")
    
    return issues['summary']['total_issues'] == 0


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
