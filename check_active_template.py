import os
os.environ['PYTHONPATH'] = '/d/next-postgres-starter'

import sys
sys.path.insert(0, '/d/next-postgres-starter')

# Use Supabase client directly
from supabase import create_client

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print(f"Missing env vars. URL: {'OK' if url else 'MISSING'}, KEY: {'OK' if key else 'MISSING'}")
    sys.exit(1)

client = create_client(url, key)

# Query active template
result = client.table('templates').select('*').eq('operation_type', 'handover').eq('is_active', True).execute()

print("Active handover template:")
for template in result.data:
    print(f"  file_name: {template['file_name']}")
    print(f"  storage_path: {template['storage_path']}")
    print(f"  storage_provider: {template['storage_provider']}")
    print(f"  file_size_bytes: {template['file_size_bytes']}")
    print(f"  created_at: {template['created_at']}")
