#!/usr/bin/env python3
"""
Mark employees via Vercel API
"""

import requests
import os

EMPLOYEE_UUIDS = [
    '25eedbb9-8276-4d6f-9bae-70b3ac50ef1a',
    '1b5f7d32-b4f7-4791-a919-15abcf66b09e',
    # Add the rest of your 90 UUIDs here...
]

API_URL = "https://iceerpgeorgia.com/api/counteragents"

def main():
    print(f"Marking {len(EMPLOYEE_UUIDS)} counteragents as employees...")
    
    for uuid in EMPLOYEE_UUIDS:
        try:
            # Get the counteragent first
            response = requests.get(f"{API_URL}?uuid={uuid}")
            if response.status_code == 200:
                data = response.json()
                if data:
                    counteragent = data[0]
                    counteragent_id = counteragent['id']
                    
                    # Update with employee flags
                    update_response = requests.put(
                        f"{API_URL}/{counteragent_id}",
                        json={
                            **counteragent,
                            'is_emploee': True,
                            'was_emploee': True
                        }
                    )
                    
                    if update_response.status_code == 200:
                        print(f"✓ Updated {counteragent['name']}")
                    else:
                        print(f"✗ Failed to update {uuid}: {update_response.status_code}")
        except Exception as e:
            print(f"✗ Error updating {uuid}: {e}")
    
    print("Done!")

if __name__ == '__main__':
    main()
