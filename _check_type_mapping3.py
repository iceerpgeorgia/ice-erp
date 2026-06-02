import json, csv

# Read CSV properly using csv module
wb_csv = {}
with open('RS Waybills.csv', encoding='utf-8-sig', newline='') as f:
    reader = csv.DictReader(f)
    for row in reader:
        rs_id = row.get('ID', '').strip()
        type_label = row.get('ტიპი', '').strip()
        if rs_id and rs_id.isdigit():
            wb_csv[rs_id] = type_label

# Distinct type labels
distinct = {}
for v in wb_csv.values():
    distinct[v] = distinct.get(v, 0) + 1
print("Distinct type labels in CSV (properly parsed):")
for t, cnt in sorted(distinct.items(), key=lambda x: -x[1]):
    print(f"  {cnt:5d}  {t}")

# Read API
with open('_raw_api.json', encoding='utf-8-sig') as f:
    raw = json.load(f)
root_key = list(raw.keys())[0]
root = raw[root_key]
child_key = [k for k in root if isinstance(root[k], list)][0]
waybills = root[child_key]

print(f"\nTotal waybills in API response: {len(waybills)}")
print("\n=== API TYPE code -> CSV label cross-reference (proper CSV parsing) ===")
code_to_labels = {}
for w in waybills:
    rs_id = str(w.get('ID', [None])[0] if isinstance(w.get('ID'), list) else w.get('ID', ''))
    type_code = str(w.get('TYPE', [None])[0] if isinstance(w.get('TYPE'), list) else w.get('TYPE', ''))
    csv_label = wb_csv.get(rs_id)
    if csv_label:
        if type_code not in code_to_labels:
            code_to_labels[type_code] = {}
        code_to_labels[type_code][csv_label] = code_to_labels[type_code].get(csv_label, 0) + 1

for code in sorted(code_to_labels.keys(), key=int):
    print(f"  TYPE {code}: {dict(code_to_labels[code])}")

# Show IDs for 'შიდა გადაზიდვა'
print("\n=== 'შიდა გადაზიდვა' rows (IDs for API lookup) ===")
for rs_id, label in wb_csv.items():
    if label == 'შიდა გადაზიდვა':
        print(f"  ID={rs_id}")

# Show IDs for 'უკან დაბრუნება'
print("\n=== 'უკან დაბრუნება' rows (IDs for API lookup) ===")
for rs_id, label in wb_csv.items():
    if label == 'უკან დაბრუნება':
        print(f"  ID={rs_id}")
