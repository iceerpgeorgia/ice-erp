import requests
import json

# Project UUID from the UI (Chkondideli Repair project)
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Call the export endpoint on production
url = 'https://ice-roge3tb4l-iceerp.vercel.app/api/export/handover-template'
headers = {'Content-Type': 'application/json'}
payload = {'projectUuid': project_uuid, 'fileName': 'handover_export.xlsx'}

print(f'Calling {url}...')
try:
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f'Status: {response.status_code}')
    print(f'Content-Type: {response.headers.get("content-type")}')
    
    if response.status_code == 200:
        with open('handover_export.xlsx', 'wb') as f:
            f.write(response.content)
        print(f'✓ File saved: handover_export.xlsx')
        print(f'  Size: {len(response.content)} bytes')
    else:
        print(f'Error: {response.text[:200]}')
except Exception as e:
    print(f'Error: {e}')
