#!/usr/bin/env python3
import re

# Read the WaybillsTable
with open('components/figma/waybills-table.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace patterns
replacements = [
    # Component name and export
    ('export function WaybillsTable()', 'export function WaybillItemsTable()'),
    ('type Waybill = {', 'type WaybillItem = {'),
    
    # Data type references (use word boundaries to avoid partial matches)
    ('useState<Waybill[]>', 'useState<WaybillItem[]>'),
    ('useState<Waybill | null>', 'useState<WaybillItem | null>'),
    (': Waybill) =>', ': WaybillItem) =>'),
    ('(row: Waybill,', '(row: WaybillItem,'),
    
    # API endpoints
    ('/api/waybills?', '/api/waybill-items?'),
    ('/api/waybills/bulk', '/api/waybill-items/bulk'),
    ('/api/waybills/import', '/api/waybill-items/import'),
    ('/api/waybills/similar-address', '/api/waybill-items/similar-address'),
    ('/api/waybills/pdf', '/api/waybill-items/pdf'),
    ('/api/waybills/sync', '/api/waybill-items/sync'),
    
    # Storage keys
    ('waybillsFiltersV1', 'waybillItemsFiltersV1'),
    ('waybillsColumnsVersion', 'waybillItemsColumnsVersion'),
    ("'waybillsColumns'", "'waybillItemsColumns'"),
    
    # Component names in logging/comments
    ("component: 'WaybillsTable'", "component: 'WaybillItemsTable'"),
    ('[WAYBILLS_FILTER]', '[WAYBILL_ITEMS_FILTER]'),
]

for old, new in replacements:
    content = content.replace(old, new)

# Write to waybill-items-table.tsx
with open('components/figma/waybill-items-table.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ Created adapted WaybillItemsTable")
print(f"  - File size: {len(content)} bytes")
print(f"  - Made {len(replacements)} replacements")
