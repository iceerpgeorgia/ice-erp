#!/usr/bin/env python3
"""Fetch Vercel logs from the latest deployment"""
import os
import json
import subprocess
from datetime import datetime, timedelta
import sys

VERCEL_TOKEN = os.getenv('VERCEL_TOKEN')
if not VERCEL_TOKEN:
    print("❌ VERCEL_TOKEN environment variable not set")
    sys.exit(1)

print(f"🔍 Fetching latest deployment from Vercel API...")

# Get latest deployment
try:
    result = subprocess.run(
        [
            'curl', '-s',
            'https://api.vercel.com/v0/projects/ice-erp/deployments?limit=1',
            '-H', f'Authorization: Bearer {VERCEL_TOKEN}'
        ],
        capture_output=True,
        text=True
    )
    
    deployments = json.loads(result.stdout)
    if not deployments.get('deployments'):
        print("❌ No deployments found")
        sys.exit(1)
    
    deployment = deployments['deployments'][0]
    deployment_id = deployment['uid']
    created_at = deployment['createdAt']
    
    print(f"✅ Latest deployment: {deployment_id}")
    print(f"   Created: {datetime.fromtimestamp(created_at/1000).isoformat()}")
    
    # Get logs from deployment
    print(f"\n🔍 Fetching logs from deployment...")
    result = subprocess.run(
        [
            'curl', '-s',
            f'https://api.vercel.com/v0/projects/ice-erp/deployments/{deployment_id}/logs?limit=100',
            '-H', f'Authorization: Bearer {VERCEL_TOKEN}'
        ],
        capture_output=True,
        text=True
    )
    
    logs_data = json.loads(result.stdout)
    
    if 'logs' not in logs_data:
        print("Response:", logs_data)
        sys.exit(1)
    
    logs = logs_data['logs']
    
    # Filter for export-related logs
    export_logs = [
        log for log in logs 
        if 'Export Handover' in log.get('message', '') or 
           'export/handover-template' in log.get('message', '')
    ]
    
    print(f"\n📊 Total logs: {len(logs)}")
    print(f"📊 Export-related logs: {len(export_logs)}")
    
    if export_logs:
        print(f"\n{'='*80}")
        print(f"Export Handover Diagnostics:")
        print(f"{'='*80}")
        for log in export_logs:
            timestamp = datetime.fromtimestamp(log['timestamp']/1000).isoformat()
            print(f"\n[{timestamp}] {log['message']}")
            if log.get('output'):
                print(f"Output: {log['output']}")
    else:
        print(f"\n⚠️  No '[Export Handover]' logs found in latest deployment")
        print(f"\nShowing recent logs (last 20):")
        for log in logs[-20:]:
            print(f"  - {log.get('message', '')[:100]}")
            
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
