import json

with open('Chrome Logs/ice-erp-log-export-2026-06-24T17-38-28.json', 'r') as f:
    logs = json.load(f)

print("=== LOOKING FOR EXPORT LOGS ===\n")

# Find export-related logs
export_logs = [log for log in logs if 'export' in str(log.get('requestPath', '')).lower() or 'Export' in str(log.get('message', ''))]
print(f"Found {len(export_logs)} export logs\n")

if export_logs:
    for log in export_logs:
        print(f"Path: {log.get('requestPath')}")
        print(f"Method: {log.get('requestMethod')}")
        print(f"Status: {log.get('responseStatusCode')}")
        print(f"Time: {log.get('TimeUTC')}")
        print(f"Duration: {log.get('durationMs')}ms")
        print(f"Function: {log.get('function')}")
        msg = log.get('message', '')
        if msg:
            print(f"Message: {msg[:300]}")
        print()
else:
    print("No export logs found. Checking all unique paths:")
    paths = set([log.get('requestPath') for log in logs])
    for path in sorted(paths)[:20]:
        print(f"  - {path}")
