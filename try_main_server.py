import requests

# Project UUID  
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Try the main production server  
url = 'https://ice-erp.vercel.app/api/export/handover-template'
headers = {'Content-Type': 'application/json'}
payload = {'projectUuid': project_uuid, 'fileName': 'handover_export.xlsx'}

print(f'Trying main server: {url}...')
try:
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f'Status: {response.status_code}')
    
    if response.content[:2] == b'PK':
        print('✅ Got valid Excel file!')
        with open('handover_export_main.xlsx', 'wb') as f:
            f.write(response.content)
        print(f'  Saved to: handover_export_main.xlsx ({len(response.content)} bytes)')
    else:
        print('❌ Got non-Excel response')
        if response.text.startswith('<!DOCTYPE'):
            print('  Returned HTML error page')
        elif response.text.startswith('{'):
            import json
            try:
                error = json.loads(response.text)
                print(f'  Error: {error}')
            except:
                print(f'  JSON: {response.text[:200]}')
        
except Exception as e:
    print(f'Error: {e}')
