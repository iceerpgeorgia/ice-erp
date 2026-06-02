import re

# Read the RS Waybills CSV to build RS internal ID -> type map
wb_types = {}
with open('RS Waybills.csv', encoding='utf-8-sig') as f:
    lines = f.read().splitlines()

headers = lines[0].split(',')
type_col = headers.index('ტიპი')
wb_col = 0  # ზედნადები (waybill number)
id_col = headers.index('ID')

for line in lines[1:]:
    parts = line.split(',')
    if len(parts) > max(type_col, wb_col, id_col):
        rs_id = parts[id_col].strip()
        wb_no = parts[wb_col].strip()
        type_label = parts[type_col].strip()
        wb_types[rs_id] = {'wb': wb_no, 'type': type_label}

# Show distinct type labels
distinct = {}
for v in wb_types.values():
    t = v['type']
    if t not in distinct:
        distinct[t] = 0
    distinct[t] += 1

print("Distinct type labels in CSV:")
for t, cnt in sorted(distinct.items(), key=lambda x: -x[1]):
    print(f"  {cnt:5d}  {t}")

# Show the specific waybill
target = wb_types.get('1021300183')
if target:
    print(f"\nWaybill 1021300183 (0980798514): type={target['type']}")
