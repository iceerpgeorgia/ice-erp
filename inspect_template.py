#!/usr/bin/env python3
"""Inspect the structure of the Handover template"""
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

template_path = Path('public/Handover Tamplate New.xlsx')

if not template_path.exists():
    print(f"❌ Template not found: {template_path}")
    exit(1)

print(f"📋 Inspecting template: {template_path}")
print(f"📦 File size: {template_path.stat().st_size} bytes")
print()

try:
    with zipfile.ZipFile(template_path, 'r') as xlsx:
        # List all files in archive
        print("📂 Archive contents:")
        file_list = xlsx.namelist()
        for f in sorted(file_list):
            if 'sheet' in f.lower() or 'workbook' in f.lower():
                print(f"  ✓ {f}")
        
        print()
        
        # Check for sheets
        print("📄 Worksheets:")
        for i in range(1, 10):
            sheet_path = f'xl/worksheets/sheet{i}.xml'
            if sheet_path in file_list:
                try:
                    sheet_xml = xlsx.read(sheet_path).decode('utf-8')
                    # Get sheet name from workbook.xml
                    wb = xlsx.read('xl/workbook.xml').decode('utf-8')
                    # Simple extraction of sheet name
                    root = ET.fromstring(wb)
                    ns = {'': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                    sheets = root.findall('.//sheets/sheet') if root.tag.endswith('workbook') else []
                    
                    has_formulas = '<f>' in sheet_xml
                    has_values = '<v>' in sheet_xml or '<is>' in sheet_xml
                    num_cells = sheet_xml.count('<c ')
                    
                    print(f"  Sheet {i} (sheet{i}.xml):")
                    print(f"    Size: {len(sheet_xml)} bytes")
                    print(f"    Cells: {num_cells}")
                    print(f"    Has formulas: {has_formulas}")
                    print(f"    Has values: {has_values}")
                    
                    # Check for Placeholders (A1:B19 pattern)
                    if 'A' in sheet_xml and 'B' in sheet_xml:
                        # Count A and B column references
                        a_refs = sheet_xml.count('r="A')
                        b_refs = sheet_xml.count('r="B')
                        print(f"    Column A cells: {a_refs}")
                        print(f"    Column B cells: {b_refs}")
                        
                        # Check for specific key placeholders
                        if 'Project_Department' in sheet_xml or 'Project' in sheet_xml:
                            print(f"    ✓ Contains placeholder labels/values")
                        
                    # Show first 30 cells
                    import re
                    cells = re.findall(r'<c r="([^"]+)"[^>]*>.*?</c>', sheet_xml, re.DOTALL)
                    if cells:
                        print(f"    Cell references (first 10): {cells[:10]}")
                    
                    print()
                except Exception as e:
                    print(f"  Error reading sheet{i}: {e}")
                    print()
        
        # Check Handover/main sheet (sheet1.xml)
        print("🔍 Detailed analysis of sheet1.xml (Handover):")
        try:
            sheet1_xml = xlsx.read('xl/worksheets/sheet1.xml').decode('utf-8')
            
            # Check for formulas
            formula_count = sheet1_xml.count('<f>')
            print(f"  VLOOKUP formulas: {formula_count}")
            
            # Show first few formulas
            import re
            formulas = re.findall(r'<f>([^<]+)</f>', sheet1_xml)
            if formulas:
                print(f"  Sample formulas:")
                for f in formulas[:3]:
                    print(f"    - {f[:80]}")
            
            # Check for merged cells
            merged = sheet1_xml.count('<mergedCells>') + sheet1_xml.count('</mergedCell>')
            print(f"  Merged cell ranges: {merged}")
            
            # Check for styles/formatting
            has_cell_xfs = '<cellXfs' in sheet1_xml
            print(f"  Cell formatting: {has_cell_xfs}")
            
        except Exception as e:
            print(f"  Error: {e}")
        
        print()
        
        # Check Placeholders sheet (sheet2.xml)
        print("🔍 Detailed analysis of sheet2.xml (Placeholders):")
        try:
            sheet2_xml = xlsx.read('xl/worksheets/sheet2.xml').decode('utf-8')
            
            # Count cells
            cell_count = sheet2_xml.count('<c ')
            print(f"  Total cells: {cell_count}")
            
            # Count A and B column cells
            a_cells = len([m for m in re.finditer(r'r="A\d+"', sheet2_xml)])
            b_cells = len([m for m in re.finditer(r'r="B\d+"', sheet2_xml)])
            print(f"  Column A cells: {a_cells}")
            print(f"  Column B cells: {b_cells}")
            
            # Extract A and B column values
            import re
            # Find cells with content
            cells = re.findall(r'<c r="([AB]\d+)"[^>]*>.*?<t>([^<]+)</t>.*?</c>', sheet2_xml, re.DOTALL)
            if cells:
                print(f"  Cell contents (first 10):")
                for ref, value in cells[:10]:
                    val_display = value[:40].replace('\n', ' ')
                    print(f"    {ref}: {val_display}")
            else:
                # Try alternate pattern with inlineStr
                cells = re.findall(r'<c r="([AB]\d+)".*?<is><t>([^<]+)</t></is>', sheet2_xml, re.DOTALL)
                if cells:
                    print(f"  Cell contents (inlineStr format, first 10):")
                    for ref, value in cells[:10]:
                        val_display = value[:40].replace('\n', ' ')
                        print(f"    {ref}: {val_display}")
                else:
                    print(f"  ⚠️  Could not extract cell values")
            
        except Exception as e:
            print(f"  Error: {e}")
            
except Exception as e:
    print(f"❌ Error opening template: {e}")
    import traceback
    traceback.print_exc()
