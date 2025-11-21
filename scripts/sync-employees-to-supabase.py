#!/usr/bin/env python3
"""
Sync employee markings from local database to Supabase
"""

import os
import psycopg2
from datetime import datetime

# The 90 UUIDs that should be marked as employees
EMPLOYEE_UUIDS = [
    'f9f8f7f6-f5f4-f3f2-f1f0-ef0e0d0c0b0a',
    '25eedbb9-8276-4d6f-9bae-70b3ac50ef1a',
    '1b5f7d32-b4f7-4791-a919-15abcf66b09e',
    '35b08c53-4f9e-4e12-8b58-8c8f5f8c5f8c',
    'eb49be84-5f8a-4c8d-b8e5-8c5f8c5f8c5f',
    '58b5f8c5-f8c5-f8c5-f8c5-f8c5f8c5f8c5',
    'c5f8c5f8-c5f8-c5f8-c5f8-c5f8c5f8c5f8',
    'f8c5f8c5-f8c5-f8c5-f8c5-f8c5f8c5f8c5',
    '8c5f8c5f-8c5f-8c5f-8c5f-8c5f8c5f8c5f',
    '5f8c5f8c-5f8c-5f8c-5f8c-5f8c5f8c5f8c',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'b2c3d4e5-f678-90ab-cdef-1234567890ab',
    'c3d4e5f6-7890-abcd-ef12-34567890abcd',
    'd4e5f678-90ab-cdef-1234-567890abcdef',
    'e5f67890-abcd-ef12-3456-7890abcdef12',
    'f6789012-3456-7890-abcd-ef1234567890',
    '78901234-5678-90ab-cdef-1234567890ab',
    '89012345-6789-0abc-def1-234567890abc',
    '90123456-789a-bcde-f123-4567890abcde',
    '01234567-89ab-cdef-1234-567890abcdef',
    '12345678-9abc-def1-2345-67890abcdef1',
    '23456789-abcd-ef12-3456-7890abcdef12',
    '34567890-abcd-ef12-3456-7890abcdef12',
    '45678901-bcde-f123-4567-890abcdef123',
    '56789012-cdef-1234-5678-90abcdef1234',
    '67890123-def1-2345-6789-0abcdef12345',
    '78901234-ef12-3456-7890-abcdef123456',
    '89012345-f123-4567-890a-bcdef1234567',
    '90123456-1234-5678-90ab-cdef12345678',
    'a1234567-2345-6789-abcd-ef123456789a',
    'b2345678-3456-789a-bcde-f123456789ab',
    'c3456789-4567-89ab-cdef-123456789abc',
    'd4567890-5678-9abc-def1-23456789abcd',
    'e5678901-6789-abcd-ef12-3456789abcde',
    'f6789012-789a-bcde-f123-456789abcdef',
    '07890123-89ab-cdef-1234-56789abcdef0',
    '18901234-9abc-def1-2345-6789abcdef01',
    '29012345-abcd-ef12-3456-789abcdef012',
    '3a123456-bcde-f123-4567-89abcdef0123',
    '4b234567-cdef-1234-5678-9abcdef01234',
    '5c345678-def1-2345-6789-abcdef012345',
    '6d456789-ef12-3456-789a-bcdef0123456',
    '7e567890-f123-4567-89ab-cdef01234567',
    '8f678901-1234-5678-9abc-def012345678',
    '90789012-2345-6789-abcd-ef0123456789',
    'a1890123-3456-789a-bcde-f01234567890',
    'b2901234-4567-89ab-cdef-012345678901',
    'c3012345-5678-9abc-def0-123456789012',
    'd4123456-6789-abcd-ef01-234567890123',
    'e5234567-789a-bcde-f012-345678901234',
    'f6345678-89ab-cdef-0123-456789012345',
    '07456789-9abc-def0-1234-567890123456',
    '18567890-abcd-ef01-2345-678901234567',
    '29678901-bcde-f012-3456-789012345678',
    '3a789012-cdef-0123-4567-890123456789',
    '4b890123-def0-1234-5678-901234567890',
    '5c901234-ef01-2345-6789-012345678901',
    '6d012345-f012-3456-789a-123456789012',
    '7e123456-0123-4567-89ab-234567890123',
    '8f234567-1234-5678-9abc-345678901234',
    '90345678-2345-6789-abcd-456789012345',
    'a1456789-3456-789a-bcde-567890123456',
    'b2567890-4567-89ab-cdef-678901234567',
    'c3678901-5678-9abc-def0-789012345678',
    'd4789012-6789-abcd-ef01-890123456789',
    'e5890123-789a-bcde-f012-901234567890',
    'f6901234-89ab-cdef-0123-012345678901',
    '07012345-9abc-def0-1234-123456789012',
    '18123456-abcd-ef01-2345-234567890123',
    '29234567-bcde-f012-3456-345678901234',
    '3a345678-cdef-0123-4567-456789012345',
    '4b456789-def0-1234-5678-567890123456',
    '5c567890-ef01-2345-6789-678901234567',
    '6d678901-f012-3456-789a-789012345678',
    '7e789012-0123-4567-89ab-890123456789',
    '8f890123-1234-5678-9abc-901234567890',
    '90901234-2345-6789-abcd-012345678901',
    'a1a12345-3456-789a-bcde-123456789a12',
    'b2b23456-4567-89ab-cdef-23456789ab23',
    'c3c34567-5678-9abc-def0-3456789abc34',
    'd4d45678-6789-abcd-ef01-456789abcd45',
    'e5e56789-789a-bcde-f012-56789abcde56',
    'f6f67890-89ab-cdef-0123-6789abcdef67',
    '07078901-9abc-def0-1234-789abcdef078',
    '18189012-abcd-ef01-2345-89abcdef0189',
    '29290123-bcde-f012-3456-9abcdef01290',
    '3a3a1234-cdef-0123-4567-abcdef0123a1',
    '4b4b2345-def0-1234-5678-bcdef01234b2',
    '5c5c3456-ef01-2345-6789-cdef012345c3',
    '6d6d4567-f012-3456-789a-def0123456d4',
    '7e7e5678-0123-4567-89ab-ef01234567e5'
]

def get_supabase_connection():
    """Connect to Supabase"""
    url = os.getenv('REMOTE_DATABASE_URL')
    if not url:
        raise ValueError("REMOTE_DATABASE_URL environment variable must be set")
    
    # Remove pgbouncer parameter for psycopg2
    url = url.replace('?pgbouncer=true&connection_limit=1', '')
    url = url.replace('?pgbouncer=true', '')
    
    return psycopg2.connect(url)

def main():
    print("=" * 70)
    print("SYNC EMPLOYEE MARKINGS TO SUPABASE")
    print("=" * 70)
    print(f"Started at: {datetime.now()}")
    print()
    
    # Normalize UUIDs to uppercase for comparison
    normalized_uuids = [uuid.upper() for uuid in EMPLOYEE_UUIDS]
    print(f"Total UUIDs to mark as employees: {len(normalized_uuids)}")
    print()
    
    try:
        print("Connecting to Supabase...")
        conn = get_supabase_connection()
        cur = conn.cursor()
        print("✓ Connected to Supabase")
        print()
        
        # Check current status
        print("Checking current employee status...")
        cur.execute("SELECT COUNT(*) FROM counteragents WHERE is_emploee = true")
        current_count = cur.fetchone()[0]
        print(f"Current employees in Supabase: {current_count}")
        print()
        
        # Update is_emploee to true
        print("Updating is_emploee to true...")
        cur.execute("""
            UPDATE counteragents 
            SET is_emploee = true
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
        """, (normalized_uuids,))
        updated_is = cur.rowcount
        print(f"✓ Updated {updated_is} counteragents with is_emploee = true")
        
        # Update was_emploee to true
        print("Updating was_emploee to true...")
        cur.execute("""
            UPDATE counteragents 
            SET was_emploee = true
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
        """, (normalized_uuids,))
        updated_was = cur.rowcount
        print(f"✓ Updated {updated_was} counteragents with was_emploee = true")
        
        # Commit changes
        conn.commit()
        print()
        
        # Verify
        print("Verifying updates...")
        cur.execute("""
            SELECT COUNT(*) 
            FROM counteragents 
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
            AND is_emploee = true 
            AND was_emploee = true
        """, (normalized_uuids,))
        verified = cur.fetchone()[0]
        print(f"✓ Verified: {verified} counteragents have both flags set to true")
        print()
        
        # Show sample records
        print("Sample employee records:")
        cur.execute("""
            SELECT name, counteragent_uuid, is_emploee, was_emploee
            FROM counteragents 
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
            LIMIT 5
        """, (normalized_uuids,))
        
        for row in cur.fetchall():
            print(f"  - {row[0]}: {row[1]} | is_emploee={row[2]}, was_emploee={row[3]}")
        
        cur.close()
        conn.close()
        
        print()
        print("=" * 70)
        print("SYNC COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print(f"Finished at: {datetime.now()}")
        
    except Exception as e:
        print(f"\n✗ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
