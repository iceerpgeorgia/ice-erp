import requests

# Project UUID
project_uuid = 'a7380446-a51d-44c2-abf1-0d3a9899d3a2'

# Call the export endpoint
url = 'https://ice-roge3tb4l-iceerp.vercel.app/api/export/handover-template'
headers = {'Content-Type': 'application/json'}
payload = {'projectUuid': project_uuid, 'fileName': 'handover_export.xlsx'}

print(f'Calling {url}...')
try:
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f'Status: {response.status_code}')
    print(f'Content-Type: {response.headers.get("content-type")}')
    print(f'Response size: {len(response.text)} chars')
    
    # Check if it's HTML (error)
    if response.text.startswith('<!DOCTYPE'):
        print('ERROR: Got HTML response (error page)')
        print('First 500 chars:')
        print(response.text[:500])
    elif response.text.startswith('{'):
        print('ERROR: Got JSON response')
        print(response.text)
    else:
        # Try to detect if it's a binary Excel file
        if response.content[:2] == b'PK':
            print('✓ Got valid Excel file (ZIP format detected)')
        else:
            print(f'Response starts with: {response.content[:50]}')
            
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
