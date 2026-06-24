import requests

# Get list of projects
url = 'https://ice-roge3tb4l-iceerp.vercel.app/api/projects'
print(f'Calling {url}...')

try:
    response = requests.get(url, timeout=10)
    print(f'Status: {response.status_code}')
    
    if response.status_code == 200:
        projects = response.json()
        print(f'Found {len(projects)} projects:')
        for p in projects[:3]:  # Show first 3
            print(f'  - {p.get("name")}: {p.get("uuid")}')
        
        # Use first project
        if projects:
            project_uuid = projects[0].get('uuid')
            print(f'\nUsing project: {project_uuid}')
    else:
        print(f'Error: {response.text[:200]}')
except Exception as e:
    print(f'Error: {e}')
