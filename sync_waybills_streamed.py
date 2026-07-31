"""
RS.GE WB_Items sync - Optimized streaming version for better performance.
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
from psycopg2.extras import execute_batch

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


def sync_waybills_streamed(file_path):
    """Stream-based sync for memory efficiency."""
    print(f"[FILE] Loading: {file_path}")
    
    if not os.path.exists(file_path):
        print(f"[ERROR] File not found")
        return None
    
    try:
        db_config = parse_database_url(os.getenv('DATABASE_URL'))
        if not db_config:
            return None
        
        conn = psycopg2.connect(**db_config)
        cur = conn.cursor()
        
        # Fetch validation dictionaries
        print(f"[DB] Fetching validation dictionaries...")
        
        cur.execute('SELECT LOWER(counteragent_uuid::text) FROM counteragents WHERE is_active = TRUE')
        valid_counteragent_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(project_uuid::text) FROM projects')
        valid_project_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(uuid::text) FROM inventories WHERE is_active = TRUE')
        valid_inventory_guids = set(row[0] for row in cur.fetchall())
        
        cur.execute('SELECT LOWER(uuid::text) FROM financial_codes WHERE is_active = TRUE')
        valid_code_guids = set(row[0] for row in cur.fetchall())
        
        print(f"   Counteragents: {len(valid_counteragent_guids):,}")
        print(f"   Projects: {len(valid_project_guids):,}")
        print(f"   Inventories: {len(valid_inventory_guids):,}")
        print(f"   Codes: {len(valid_code_guids):,}")
        
        # Load XLSX with streaming
        print(f"\n[XLSX] Opening file...")
        try:
            wb = load_workbook(file_path, data_only=True)
            ws = wb.active
            
            # Get headers
            headers = [cell.value for cell in ws[1]]
            print(f"   Headers: {len(headers)} columns")
        except Exception as e:
            print(f"[ERROR] Failed to load XLSX: {e}")
            import traceback
            traceback.print_exc()
            return None
        
        # Find GUID column indices
        col_map = {}
        for col_idx, header in enumerate(headers):
            col_map[header] = col_idx
        
        # Stats
        stats = {
            'total_rows': ws.max_row - 1,
            'items_inserted': 0,
            'items_updated': 0,
            'skipped': 0,
            'errors': []
        }
        
        inconsistencies = {
            'invalid_counteragent_guid': [],
            'invalid_project_guid': [],
            'invalid_inventory_guid': [],
            'invalid_code_guid': [],
            'missing_required_fields': [],
            'sync_errors': []
        }
        
        print(f"\n[SYNC] Processing {stats['total_rows']:,} rows...")
        
        # Process rows
        for row_idx in range(2, ws.max_row + 1):
            if row_idx % 5000 == 0:
                print(f"   Row {row_idx}/{ws.max_row}...")
            
            try:
                # Extract data
                waybill_no = ws.cell(row=row_idx, column=col_map.get('ზედნადების ნომერი', 0) + 1).value
                goods_code = ws.cell(row=row_idx, column=col_map.get('საქონლის კოდი', 0) + 1).value
                goods_name = ws.cell(row=row_idx, column=col_map.get('საქონლის დასახელება', 0) + 1).value
                
                # Extract GUIDs
                counteragent_guid = ws.cell(row=row_idx, column=col_map.get('კონტრაგენტის GUID', 0) + 1).value
                project_guid = ws.cell(row=row_idx, column=col_map.get('პროექტი GUID', 0) + 1).value
                inventory_guid = ws.cell(row=row_idx, column=col_map.get('საქონელი GUID', 0) + 1).value
                code_guid = ws.cell(row=row_idx, column=col_map.get('კოდის GUID', 0) + 1).value
                
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
                        'row': row_idx,
                        'guid': counteragent_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                if project_guid and project_guid not in valid_project_guids:
                    inconsistencies['invalid_project_guid'].append({
                        'row': row_idx,
                        'guid': project_guid if project_guid != '#n/a' else '#n/a (Excel error)',
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                if inventory_guid and inventory_guid not in valid_inventory_guids:
                    inconsistencies['invalid_inventory_guid'].append({
                        'row': row_idx,
                        'guid': inventory_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                if code_guid and code_guid not in valid_code_guids:
                    inconsistencies['invalid_code_guid'].append({
                        'row': row_idx,
                        'guid': code_guid,
                        'waybill': waybill_no
                    })
                    stats['skipped'] += 1
                    continue
                
                # Check required fields
                if not waybill_no or not goods_code:
                    inconsistencies['missing_required_fields'].append({
                        'row': row_idx,
                        'waybill_no': waybill_no,
                        'goods_code': goods_code
                    })
                    stats['skipped'] += 1
                    continue
                
                # Insert or update
                if inventory_guid:
                    # Check if exists
                    cur.execute(
                        'SELECT uuid FROM rs_waybills_in_items WHERE waybill_no = %s AND goods_code = %s LIMIT 1',
                        (str(waybill_no), str(int(goods_code) if isinstance(goods_code, (int, float)) else goods_code))
                    )
                    existing = cur.fetchone()
                    
                    if existing:
                        cur.execute('''
                            UPDATE rs_waybills_in_items
                            SET goods_name = %s, inventory_uuid = %s, financial_code_uuid = %s, updated_at = NOW()
                            WHERE waybill_no = %s AND goods_code = %s
                        ''', (
                            goods_name,
                            inventory_guid,
                            code_guid,
                            str(waybill_no),
                            str(int(goods_code) if isinstance(goods_code, (int, float)) else goods_code)
                        ))
                        stats['items_updated'] += 1
                    else:
                        cur.execute('''
                            INSERT INTO rs_waybills_in_items (
                                waybill_no, goods_code, goods_name, inventory_uuid, financial_code_uuid, created_at, updated_at
                            ) VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        ''', (
                            str(waybill_no),
                            str(int(goods_code) if isinstance(goods_code, (int, float)) else goods_code),
                            goods_name,
                            inventory_guid,
                            code_guid
                        ))
                        stats['items_inserted'] += 1
            
            except Exception as e:
                inconsistencies['sync_errors'].append({
                    'row': row_idx,
                    'error': str(e)[:100]
                })
                stats['errors'].append(str(e))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"   Sync complete!")
        
        return {
            'stats': stats,
            'inconsistencies': inconsistencies
        }
    
    except Exception as e:
        print(f"[ERROR] Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    print("[START] RS.GE Waybills Sync (Streaming)")
    print("=" * 80)
    
    file_path = r"D:\next-postgres-starter\Prompts\RS.GE - WB_Items_IN.xlsx"
    
    # Sync
    result = sync_waybills_streamed(file_path)
    if not result:
        print("[ERROR] Sync failed")
        return
    
    # Print report
    stats = result['stats']
    inconsistencies = result['inconsistencies']
    
    print(f"\n" + "=" * 80)
    print("SYNC REPORT")
    print("=" * 80)
    
    print(f"\nOVERALL STATS:")
    print(f"  Total rows processed: {stats['total_rows']:,}")
    print(f"  Items inserted: {stats['items_inserted']:,}")
    print(f"  Items updated: {stats['items_updated']:,}")
    print(f"  Rows skipped: {stats['skipped']:,}")
    print(f"  Sync errors: {len(stats['errors'])}")
    
    total_issues = sum(len(v) if isinstance(v, list) else 0 for v in inconsistencies.values())
    print(f"\nINCONSISTENCIES FOUND: {total_issues}")
    
    # Print inconsistency details
    if inconsistencies['invalid_counteragent_guid']:
        print(f"\n  ✗ Invalid Counteragent GUIDs: {len(inconsistencies['invalid_counteragent_guid'])}")
        for issue in inconsistencies['invalid_counteragent_guid'][:3]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
    
    if inconsistencies['invalid_project_guid']:
        print(f"\n  ✗ Invalid Project GUIDs: {len(inconsistencies['invalid_project_guid'])}")
        for issue in inconsistencies['invalid_project_guid'][:3]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
    
    if inconsistencies['invalid_inventory_guid']:
        print(f"\n  ✗ Invalid Inventory GUIDs: {len(inconsistencies['invalid_inventory_guid'])}")
        for issue in inconsistencies['invalid_inventory_guid'][:3]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
    
    if inconsistencies['invalid_code_guid']:
        print(f"\n  ✗ Invalid Code GUIDs: {len(inconsistencies['invalid_code_guid'])}")
        for issue in inconsistencies['invalid_code_guid'][:3]:
            print(f"    Row {issue['row']}: {issue['guid']} (Waybill: {issue['waybill']})")
    
    if inconsistencies['missing_required_fields']:
        print(f"\n  ⚠ Missing Required Fields: {len(inconsistencies['missing_required_fields'])}")
        for issue in inconsistencies['missing_required_fields'][:3]:
            print(f"    Row {issue['row']}: waybill={issue['waybill_no']}, code={issue['goods_code']}")
    
    if inconsistencies['sync_errors']:
        print(f"\n  ✗ Sync Errors: {len(inconsistencies['sync_errors'])}")
        for issue in inconsistencies['sync_errors'][:3]:
            print(f"    Row {issue['row']}: {issue['error']}")
    
    # Save JSON report
    report = {
        'timestamp': datetime.now().isoformat(),
        'stats': stats,
        'inconsistencies': inconsistencies
    }
    
    with open('waybill_sync_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n[OK] Detailed report saved: waybill_sync_report.json")
    print("\n[COMPLETE]")


if __name__ == '__main__':
    main()
