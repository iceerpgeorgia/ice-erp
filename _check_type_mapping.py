import json, subprocess, re

# Read the RS Waybills CSV  
wb_csv = {}
with open('RS Waybills.csv', encoding='utf-8-sig') as f:
    lines = f.read().splitlines()

headers = lines[0].split(',')
type_col = headers.index('ტიპი')
wb_col = 0
id_col = headers.index('ID')

for line in lines[1:]:
    parts = line.split(',')
    if len(parts) > max(type_col, id_col):
        rs_id = parts[id_col].strip()
        type_label = parts[type_col].strip()
        wb_csv[rs_id] = type_label

# Read cached raw API JSON - use the last sync output
# We already know from the terminal that the raw API has TYPE fields
# Let's call the API via PowerShell and save to a temp file
import os
result = subprocess.run(
    ['powershell', '-Command',
     '$secret = "pA0josnPQ0Qnee6B47f7ATN/GN60cNfxU3SXJKZwSQA="; '
     '$body = \'{"begin_date":"2026-05-01T00:00:00","end_date":"2026-05-26T00:00:00","raw":true}\'; '
     '$r = Invoke-RestMethod -Method POST -Uri "https://ice-erp.vercel.app/api/waybills/sync" '
     '-Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json" } -Body $body; '
     '$r.raw | ConvertTo-Json -Depth 20 | Out-File -FilePath "_raw_api.json" -Encoding utf8'],
    capture_output=True, text=True, timeout=60
)
print("Fetched API data, stderr:", result.stderr[:200] if result.stderr else "none")

with open('_raw_api.json', encoding='utf-8-sig') as f:
    raw = json.load(f)

# Navigate to waybill list
root_key = list(raw.keys())[0]
root = raw[root_key]
child_key = [k for k in root if isinstance(root[k], list)][0]
waybills = root[child_key]

print(f"\nTotal waybills in API response: {len(waybills)}")
print("\nCross-reference API TYPE code -> CSV label:")
code_to_labels = {}
for w in waybills:
    rs_id = str(w.get('ID', [None])[0] if isinstance(w.get('ID'), list) else w.get('ID', ''))
    type_code = str(w.get('TYPE', [None])[0] if isinstance(w.get('TYPE'), list) else w.get('TYPE', ''))
    csv_label = wb_csv.get(rs_id, '?')
    if csv_label != '?':
        if type_code not in code_to_labels:
            code_to_labels[type_code] = {}
        code_to_labels[type_code][csv_label] = code_to_labels[type_code].get(csv_label, 0) + 1

for code in sorted(code_to_labels.keys()):
    print(f"  TYPE {code}: {dict(code_to_labels[code])}")

# Show the specific waybill
for w in waybills:
    rs_id = str(w.get('ID', [None])[0] if isinstance(w.get('ID'), list) else w.get('ID', ''))
    if rs_id == '1021300183':
        type_code = str(w.get('TYPE', [None])[0] if isinstance(w.get('TYPE'), list) else w.get('TYPE', ''))
        print(f"\nWaybill 1021300183: API TYPE={type_code}, CSV={wb_csv.get(rs_id, '?')}")
