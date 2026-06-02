import json

# Read CSV
wb_csv = {}
with open('RS Waybills.csv', encoding='utf-8-sig') as f:
    lines = f.read().splitlines()
headers = lines[0].split(',')
type_col = headers.index('ტიპი')
id_col = headers.index('ID')
for line in lines[1:]:
    parts = line.split(',')
    if len(parts) > max(type_col, id_col):
        rs_id = parts[id_col].strip()
        type_label = parts[type_col].strip()
        wb_csv[rs_id] = type_label

# Read API
with open('_raw_api.json', encoding='utf-8-sig') as f:
    raw = json.load(f)

root_key = list(raw.keys())[0]
root = raw[root_key]
child_key = [k for k in root if isinstance(root[k], list)][0]
waybills = root[child_key]

# Build type code to label mapping from intersection
code_to_labels = {}
for w in waybills:
    rs_id = str(w.get('ID', [None])[0] if isinstance(w.get('ID'), list) else w.get('ID', ''))
    type_code = str(w.get('TYPE', [None])[0] if isinstance(w.get('TYPE'), list) else w.get('TYPE', ''))
    wbn = str(w.get('WAYBILL_NUMBER', [None])[0] if isinstance(w.get('WAYBILL_NUMBER'), list) else w.get('WAYBILL_NUMBER', ''))
    csv_label = wb_csv.get(rs_id)
    if csv_label:
        if type_code not in code_to_labels:
            code_to_labels[type_code] = {}
        code_to_labels[type_code][csv_label] = code_to_labels[type_code].get(csv_label, 0) + 1
    # print unmatched types too
    else:
        pass

print("=== API TYPE code -> CSV label cross-reference ===")
for code in sorted(code_to_labels.keys(), key=int):
    print(f"  TYPE {code}: {dict(code_to_labels[code])}")

# Check "შიდა გადაზიდვა" rows in CSV
print("\n=== CSV rows with 'შიდა გადაზიდვა' ===")
for line in lines[1:]:
    parts = line.split(',')
    if len(parts) > type_col and parts[type_col].strip() == 'შიდა გადაზიდვა':
        rs_id = parts[id_col].strip()
        print(f"  ID={rs_id} type={parts[type_col].strip()}")

# Check "უკან დაბრუნება" rows in CSV
print("\n=== CSV rows with 'უკან დაბრუნება' ===")
for line in lines[1:]:
    parts = line.split(',')
    if len(parts) > type_col and parts[type_col].strip() == 'უკან დაბრუნება':
        rs_id = parts[id_col].strip()
        print(f"  ID={rs_id} type={parts[type_col].strip()}")
