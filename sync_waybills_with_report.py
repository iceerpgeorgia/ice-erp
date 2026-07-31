"""
RS.GE WB_Items sync to database - Comprehensive sync with inconsistency tracking.
Syncs waybills and waybill_items from XLSX to database, tracks all issues.
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
from psycopg2.extras import execute_values

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


def load_xlsx_rows(file_path):
    """Load all rows from XLSX."""
    print(f"[FILE] Loading: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"[ERROR] File not found")
        return None, None
    
    try:
        wb = load_workbook(file_path, data_only=True)
        ws = wb.active
        
        # Get headers
        headers = [cell.value for cell in ws[1]]
        
        # Find all column indices
        col_indices = {}
        for col_idx, header in enumerate(headers):
            col_indices[header] = col_idx
        
        print(f"   Headers: {len(headers)} columns")
        
        # Load all rows
        rows = []
        for row_idx in range(2, ws.max_row + 1):
            row_values = []
            for cell in ws[row_idx]:
                row_values.append(cell.value)
            
            # Convert to dict using headers
            row_dict = {}
            for col_idx, header in enumerate(headers):
                if col_idx < len(row_values):
                    row_dict[header] = row_values[col_idx]
            
            rows.append({
                'row_number': row_idx,
                'data': row_dict
            })
        
        print(f"   [OK] Loaded {len(rows)} data rows")
        return rows, col_indices
    
    except Exception as e:
        print(f"[ERROR] Error loading XLSX: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def sync_waybills_and_items(rows, col_indices):
    """Sync waybills and items to database."""
    print(f"\n[SYNC] Starting sync process...")
    
    try:
        db_config = parse_database_url(os.getenv('DATABASE_URL'))
        if not db_config:
            print("[ERROR] Failed to parse DATABASE_URL")
            return None
        
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Track stats
        stats = {
            'total_rows': len(rows),
            'waybills_inserted': 0,
            'waybills_updated': 0,
            'items_inserted': 0,
            'items_updated': 0,
            'skipped': 0,
            'errors': []
        }
        
        # Track inconsistencies
        inconsistencies = {
            'invalid_counteragent_guid': [],
            'invalid_project_guid': [],
            'invalid_inventory_guid': [],
            'invalid_code_guid': [],
            'missing_required_fields': [],
            'duplicate_items': [],
            'sync_errors': []
        }
        
        # Get valid GUID sets for validation during sync
        cur.execute('SELECT LOWER(counteragent_uuid::text) FROM counteragents WHERE is_active = TRUE')
        valid_counteragent_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(project_uuid::text) FROM projects')
        valid_project_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(uuid::text) FROM inventories WHERE is_active = TRUE')
        valid_inventory_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(uuid::text) FROM financial_codes WHERE is_active = TRUE')
        valid_code_guids = set(row[0] for row in cur.fetchall())
        
        print(f"   Loaded validation dictionaries")
        print(f"     Counteragents: {len(valid_counteragent_guids):,}")
        print(f"     Projects: {len(valid_project_guids):,}")
        print(f"     Inventories: {len(valid_inventory_guids):,}")
        print(f"     Codes: {len(valid_code_guids):,}")
        
        # Process each row
        for idx, row in enumerate(rows):
            if (idx + 1) % 5000 == 0:
                print(f"   Processing row {idx + 1}/{len(rows)}...")
            
            row_number = row['row_number']
            data = row['data']
            
            try:
                # Extract key fields
                waybill_no = data.get('ზედნადების ნომერი')
                goods_code = data.get('საქონლის კოდი')
                goods_name = data.get('საქონლის დასახელება')
                
                # Extract GUIDs
                counteragent_guid = data.get('კონტრაგენტის GUID')
                project_guid = data.get('პროექტი GUID')
                inventory_guid = data.get('საქონელი GUID')
                code_guid = data.get('კოდის GUID')
                
                # Normalize GUIDs
                if counteragent_guid and isinstance(counteragent_guid, str):
                    counteragent_guid = counteragent_guid.strip().lower()
                if project_guid and isinstance(project_guid, str):
                    project_guid = project_guid.strip().lower()
                if inventory_guid and isinstance(inventory_guid, str):
                    inventory_guid = inventory_guid.strip().lower()
                if code_guid and isinstance(code_guid, str):
                    code_guid = code_guid.strip().lower()
                
                # Validate GUIDs
                if counteragent_guid and counteragent_guid not in valid_counteragent_guids:
                    inconsistencies['invalid_counteragent_guid'].append({
                        'row': row_number,
                        'guid': counteragent_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                if project_guid and project_guid not in valid_project_guids:
                    # Special case for #n/a
                    if project_guid == '#n/a':
                        inconsistencies['invalid_project_guid'].append({
                            'row': row_number,
                            'guid': '#n/a (Excel error)',
                            'waybill': waybill_no
                        })
                    else:
                        inconsistencies['invalid_project_guid'].append({
                            'row': row_number,
                            'guid': project_guid,
                            'waybill': waybill_no
                        })
                    stats['skipped'] += 1
                    continue
                
                if inventory_guid and inventory_guid not in valid_inventory_guids:
                    inconsistencies['invalid_inventory_guid'].append({
                        'row': row_number,
                        'guid': inventory_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                if code_guid and code_guid not in valid_code_guids:
                    inconsistencies['invalid_code_guid'].append({
                        'row': row_number,
                        'guid': code_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                # Check required fields
                if not waybill_no or not goods_code:
                    inconsistencies['missing_required_fields'].append({
                        'row': row_number,
                        'waybill_no': waybill_no,
                        'goods_code': goods_code
                    })
                    stats['skipped'] += 1
                    continue
                
                # Try to insert/update waybill item
                # rs_waybills_in_items table
                if waybill_no and inventory_guid:
                    # Check if already exists
                    cur.execute(
                        'SELECT uuid FROM rs_waybills_in_items WHERE waybill_no = %s AND goods_code = %s LIMIT 1',
                        (str(waybill_no), str(goods_code))
                    )
                    existing = cur.fetchone()
                    
                    if existing:
                        # Update
                        cur.execute('''
                            UPDATE rs_waybills_in_items
                            SET goods_name = %s, inventory_uuid = %s, financial_code_uuid = %s, updated_at = NOW()
                            WHERE waybill_no = %s AND goods_code = %s
                        ''', (
                            goods_name,
                            inventory_guid,
                            code_guid,
                            str(waybill_no),
                            str(goods_code)
                        ))
                        stats['items_updated'] += 1
                    else:
                        # Insert
                        cur.execute('''
                            INSERT INTO rs_waybills_in_items (
                                waybill_no, goods_code, goods_name, inventory_uuid, financial_code_uuid, created_at, updated_at
                            ) VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        ''', (
                            str(waybill_no),
                            str(goods_code),
                            goods_name,
                            inventory_guid,
                            code_guid
                        ))
                        stats['items_inserted'] += 1
            
            except Exception as e:
                inconsistencies['sync_errors'].append({
                    'row': row_number,
                    'error': str(e)
                })
                stats['errors'].append(str(e))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"\n   Sync complete!")
        return {
            'stats': stats,
            'inconsistencies': inconsistencies
        }
    
    except Exception as e:
        print(f"[ERROR] Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return None


def generate_report(sync_result):
    """Generate comprehensive sync report."""
    print(f"\n[REPORT] Generating report...")
    
    stats = sync_result['stats']
    inconsistencies = sync_result['inconsistencies']
    
    print(f"\n" + "=" * 80)
    print("SYNC REPORT")
    print("=" * 80)
    
    print(f"\nOVERALL STATS:")
    print(f"  Total rows processed: {stats['total_rows']:,}")
    print(f"  Waybill items inserted: {stats['items_inserted']:,}")
    print(f"  Waybill items updated: {stats['items_updated']:,}")
    print(f"  Rows skipped: {stats['skipped']:,}")
    print(f"  Sync errors: {len(stats['errors'])}")
    
    total_issues = sum(len(v) if isinstance(v, list) else 0 for v in inconsistencies.values())
    print(f"\nINCONSISTENCIES FOUND: {total_issues}")
    
    # Print inconsistency details
    if inconsistencies['invalid_counteragent_guid']:
        print(f"\n  Invalid Counteragent GUIDs: {len(inconsistencies['invalid_counteragent_guid'])}")
        for issue in inconsistencies['invalid_counteragent_guid'][:5]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
        if len(inconsistencies['invalid_counteragent_guid']) > 5:
            print(f"    ... and {len(inconsistencies['invalid_counteragent_guid']) - 5} more")
    
    if inconsistencies['invalid_project_guid']:
        print(f"\n  Invalid Project GUIDs: {len(inconsistencies['invalid_project_guid'])}")
        for issue in inconsistencies['invalid_project_guid'][:5]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
        if len(inconsistencies['invalid_project_guid']) > 5:
            print(f"    ... and {len(inconsistencies['invalid_project_guid']) - 5} more")
    
    if inconsistencies['invalid_inventory_guid']:
        print(f"\n  Invalid Inventory GUIDs: {len(inconsistencies['invalid_inventory_guid'])}")
        for issue in inconsistencies['invalid_inventory_guid'][:5]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
        if len(inconsistencies['invalid_inventory_guid']) > 5:
            print(f"    ... and {len(inconsistencies['invalid_inventory_guid']) - 5} more")
    
    if inconsistencies['invalid_code_guid']:
        print(f"\n  Invalid Code GUIDs: {len(inconsistencies['invalid_code_guid'])}")
        for issue in inconsistencies['invalid_code_guid'][:5]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
        if len(inconsistencies['invalid_code_guid']) > 5:
            print(f"    ... and {len(inconsistencies['invalid_code_guid']) - 5} more")
    
    if inconsistencies['missing_required_fields']:
        print(f"\n  Missing Required Fields: {len(inconsistencies['missing_required_fields'])}")
        for issue in inconsistencies['missing_required_fields'][:5]:
            print(f"    Row {issue['row']}: waybill_no={issue['waybill_no']}, goods_code={issue['goods_code']}")
        if len(inconsistencies['missing_required_fields']) > 5:
            print(f"    ... and {len(inconsistencies['missing_required_fields']) - 5} more")
    
    if inconsistencies['sync_errors']:
        print(f"\n  Sync Errors: {len(inconsistencies['sync_errors'])}")
        for issue in inconsistencies['sync_errors'][:5]:
            print(f"    Row {issue['row']}: {issue['error']}")
        if len(inconsistencies['sync_errors']) > 5:
            print(f"    ... and {len(inconsistencies['sync_errors']) - 5} more")
    
    # Save JSON report
    report = {
        'timestamp': datetime.now().isoformat(),
        'stats': stats,
        'inconsistencies': inconsistencies
    }
    
    with open('waybill_sync_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n[OK] Detailed report saved: waybill_sync_report.json")
    
    return report


def main():
    print("[START] RS.GE Waybills Sync")
    print("=" * 80)
    
    # Load XLSX
    file_path = r"D:\next-postgres-starter\Prompts\RS.GE - WB_Items_IN.xlsx"
    rows, col_indices = load_xlsx_rows(file_path)
    if not rows:
        print("[ERROR] Failed to load XLSX")
        return
    
    # Sync to database
    sync_result = sync_waybills_and_items(rows, col_indices)
    if not sync_result:
        print("[ERROR] Failed to sync to database")
        return
    
    # Generate report
    report = generate_report(sync_result)
    
    print("\n[COMPLETE]")


if __name__ == '__main__':
    main()
