#!/usr/bin/env python3
"""Compare counteragents tables between local and remote (Vercel/Supabase) databases"""

import psycopg2
import os
from dotenv import load_dotenv
from collections import defaultdict

# Load environment variables
load_dotenv('.env.local')

# Local database connection
LOCAL_DB_URL = os.getenv('DATABASE_URL')
if '?schema=' in LOCAL_DB_URL:
    LOCAL_DB_URL = LOCAL_DB_URL.split('?')[0]

# Remote database connection
# Option 1: Set REMOTE_DATABASE_URL in .env.local for comparison
# Option 2: Pass as command line argument
REMOTE_DB_URL = os.getenv('REMOTE_DATABASE_URL') or os.getenv('VERCEL_DATABASE_URL')

if not REMOTE_DB_URL:
    print("=" * 100)
    print("ERROR: Remote database URL not configured")
    print("=" * 100)
    print("\nPlease set one of the following in your .env.local file:")
    print("  REMOTE_DATABASE_URL=<your-supabase-connection-string>")
    print("  or")
    print("  VERCEL_DATABASE_URL=<your-vercel-postgres-url>")
    print("\nExample for Supabase:")
    print("  REMOTE_DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres")
    print("\nExample for Vercel Postgres:")
    print("  VERCEL_DATABASE_URL=postgres://default:[PASSWORD]@xxxxx.postgres.vercel-storage.com:5432/verceldb")
    print("\n" + "=" * 100)
    exit(1)

# Clean up Supabase pooler parameters that psycopg2 doesn't understand
if '?pgbouncer=' in REMOTE_DB_URL:
    REMOTE_DB_URL = REMOTE_DB_URL.split('?')[0]

def get_counteragents(conn, db_name):
    """Fetch all counteragents from the database"""
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            id, 
            counteragent_uuid, 
            name, 
            identification_number, 
            entity_type_uuid,
            country_uuid,
            is_active,
            created_at,
            updated_at
        FROM counteragents
        ORDER BY counteragent_uuid
    """)
    
    rows = cur.fetchall()
    cur.close()
    
    print(f"\n{db_name}: Found {len(rows)} counteragents")
    return rows

def compare_records(local_records, remote_records):
    """Compare two sets of records and report differences"""
    
    # Create dictionaries keyed by UUID for easy comparison
    local_dict = {row[1]: row for row in local_records}  # row[1] is counteragent_uuid
    remote_dict = {row[1]: row for row in remote_records}
    
    local_uuids = set(local_dict.keys())
    remote_uuids = set(remote_dict.keys())
    
    only_in_local = local_uuids - remote_uuids
    only_in_remote = remote_uuids - local_uuids
    in_both = local_uuids & remote_uuids
    
    print("\n" + "=" * 100)
    print("COMPARISON SUMMARY")
    print("=" * 100)
    print(f"Total in LOCAL:  {len(local_records)}")
    print(f"Total in REMOTE: {len(remote_records)}")
    print(f"In both:         {len(in_both)}")
    print(f"Only in LOCAL:   {len(only_in_local)}")
    print(f"Only in REMOTE:  {len(only_in_remote)}")
    
    # Check if identical
    if len(only_in_local) == 0 and len(only_in_remote) == 0:
        # Check if data is identical for matching UUIDs
        differences = []
        for uuid in in_both:
            local_rec = local_dict[uuid]
            remote_rec = remote_dict[uuid]
            
            # Compare fields (skip id, created_at, updated_at which may differ)
            diff_fields = []
            if local_rec[2] != remote_rec[2]:  # name
                diff_fields.append(f"name: '{local_rec[2]}' vs '{remote_rec[2]}'")
            if local_rec[3] != remote_rec[3]:  # identification_number
                diff_fields.append(f"identification_number: '{local_rec[3]}' vs '{remote_rec[3]}'")
            if local_rec[4] != remote_rec[4]:  # entity_type_uuid
                diff_fields.append(f"entity_type_uuid: '{local_rec[4]}' vs '{remote_rec[4]}'")
            if local_rec[5] != remote_rec[5]:  # country_uuid
                diff_fields.append(f"country_uuid: '{local_rec[5]}' vs '{remote_rec[5]}'")
            if local_rec[6] != remote_rec[6]:  # is_active
                diff_fields.append(f"is_active: {local_rec[6]} vs {remote_rec[6]}")
            
            if diff_fields:
                differences.append({
                    'uuid': uuid,
                    'local': local_rec,
                    'remote': remote_rec,
                    'diff_fields': diff_fields
                })
        
        if len(differences) == 0:
            print("\n✅ DATABASES ARE IDENTICAL - All records match perfectly!")
            return True
        else:
            print(f"\n⚠️  DATABASES HAVE DIFFERENCES - {len(differences)} records have different data")
            print("\nFirst 5 differences:")
            for i, diff in enumerate(differences[:5], 1):
                print(f"\n{i}. UUID: {diff['uuid']}")
                print(f"   Name: {diff['local'][2]}")
                print(f"   Different fields:")
                for field_diff in diff['diff_fields']:
                    print(f"      - {field_diff}")
            return False
    
    # Report missing records
    if only_in_local:
        print(f"\n❌ {len(only_in_local)} records ONLY IN LOCAL:")
        for i, uuid in enumerate(sorted(list(only_in_local))[:10], 1):
            rec = local_dict[uuid]
            print(f"   {i}. {rec[2]} (UUID: {uuid}, ID: {rec[3]})")
        if len(only_in_local) > 10:
            print(f"   ... and {len(only_in_local) - 10} more")
    
    if only_in_remote:
        print(f"\n❌ {len(only_in_remote)} records ONLY IN REMOTE:")
        for i, uuid in enumerate(sorted(list(only_in_remote))[:10], 1):
            rec = remote_dict[uuid]
            print(f"   {i}. {rec[2]} (UUID: {uuid}, ID: {rec[3]})")
        if len(only_in_remote) > 10:
            print(f"   ... and {len(only_in_remote) - 10} more")
    
    print("\n" + "=" * 100)
    return False

def main():
    print("\n" + "=" * 100)
    print("COUNTERAGENTS TABLE COMPARISON - Local vs Remote")
    print("=" * 100)
    
    try:
        # Connect to local database
        print("\nConnecting to LOCAL database...")
        local_conn = psycopg2.connect(LOCAL_DB_URL)
        local_records = get_counteragents(local_conn, "LOCAL")
        local_conn.close()
        print("✓ Local connection closed")
        
        # Connect to remote database
        print("\nConnecting to REMOTE database...")
        remote_conn = psycopg2.connect(REMOTE_DB_URL)
        remote_records = get_counteragents(remote_conn, "REMOTE")
        remote_conn.close()
        print("✓ Remote connection closed")
        
        # Compare
        identical = compare_records(local_records, remote_records)
        
        if identical:
            print("\n✅ SUCCESS: Both databases are identical!")
            exit(0)
        else:
            print("\n⚠️  RESULT: Databases have differences - see details above")
            exit(1)
            
    except psycopg2.OperationalError as e:
        print(f"\n❌ CONNECTION ERROR: {e}")
        print("\nPlease verify:")
        print("  1. Database URLs are correct in .env.local")
        print("  2. Database credentials (password) are correct")
        print("  3. Network access is allowed (firewall, VPN, etc.)")
        exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
