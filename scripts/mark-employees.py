#!/usr/bin/env python3
"""Mark specific counteragents as employees."""

import os
import psycopg2

# UUIDs to mark with is_emploee = true
EMPLOYEE_UUIDS = [
    '5BEEA027-BF57-4C93-AABC-21FD42F223A5',
    'A26DCE96-C08F-453E-9E26-10AAF72D142A',
    'AD901E05-ADD9-42DE-89BA-4D9A21C89BCF',
    '401318CA-BF39-49C3-9BDC-73836A8F9774',
    '0C7F8DB5-32E0-420B-B059-CA204377F0F3',
    'a703de60-7255-40f6-bcd1-b990ca15c2b4',
    'ED0D2B6C-6B7A-4C51-B69C-0DFD85113EE6',
    'A778537A-20BD-4AF4-B7E0-06811F6672A1',
    '6187C79D-6113-4785-87EA-928B9F26F591',
    '19521391-5237-486E-B9F6-C4529F6D8E1D',
    '01DFE71D-5350-4A02-ABCD-C6A3C15B94EE',
    'C5D1F87D-8C4D-42C3-8E4A-B47A5A7D4D4A',
    '3B93819D-E8A3-4430-BB78-D29B6A132D24',
    '86332895-C3C3-4313-AA1C-0D1B06C2386C',
    'C309CB7C-404D-431A-A8FB-29671DCA0C49',
    '43CE8AB0-AF16-4D2F-BBEC-8DE2C7E3A31F',
    'D239BCA7-C0E0-431B-8055-6778FA312A38',
    'A68C7C4E-5733-44E9-AC09-EBA7F2FF82BC',
    'A19DBE70-93E6-453B-840F-63A4C42291DC',
    'C247EDBA-FD51-4A47-8765-F7EA1A0A9459',
    '71DC3050-596A-4C1C-B6FE-34FC2B09BF85',
    'F7212416-445A-4F9D-B4AA-1427DD9DFC06',
    '48C5647F-1795-4315-9F87-D01765033029',
    '26C8F42B-BAF8-4A8F-8C54-F9085D5E1DA6',
    '47272651-C703-4D0D-9210-7DF4F6490134',
    'ACBC2FB2-B331-42F1-B862-1D9DED071B71',
    '9A0733FD-8BE0-457E-A464-28BBBC4262F9',
    'FC664B80-3A93-44A0-87EA-EE9B500C2CFE',
    '60CE351B-2645-4B02-A392-E87AB130825D',
    'A7A68AED-8BDF-4711-B39B-97B36E9C36AC',
    '8325FD25-433C-45B8-9DE3-DEF4AF5C7BD3',
    '0E4DAFA9-9117-434C-860D-C8F52EDFDD30',
    '2792760E-0F83-4E89-AF39-83E472F42919',
    '12294EB0-E5DA-4B5B-A62C-1704BCA1ED4D',
    '293428BC-4E95-4BBC-87EA-1EC4C6E8CF0F',
    'E88993F4-B0F5-4ED2-82B1-12459C89F8A0',
    '489f2ee4-9c4d-4909-8b54-37d86935386e',
    '25EEDBB9-8276-4D6F-9BAE-70B3AC50EF1A',
    '9c4e431e-bf60-4668-96be-fe3f9b8c4066',
    'f226abbb-d682-476f-9fea-3665c62bccb6',
    '785092a8-3bc0-474e-9eda-1a29305a7200',
    'fb021eff-22cf-4ce7-9500-b3b54c3cd121',
    '3c8772d6-ed17-4a44-94bd-f19d09baa79d',
    '4e269043-dda6-40ba-af1d-bc69ff12ef7f',
    '7f6f0e56-1263-4322-8a5d-4dec80656746',
    '5CD6A71A-39EA-4BFA-A786-C5163A91043C',
    'fd6be193-fd0d-47e3-96b1-e5a6e1948c27',
    'a0a1bbba-f746-4ced-9ab8-bc82640bc32e',
    '3a916189-abb9-43d1-a31f-9ce154f571a1',
    '4c25a3b7-d112-4c46-aa9a-b2513a44f1b7',
    '91b9a6d9-53e8-47be-9a3e-b3f8b656107f',
    '08ba1560-695e-4a63-9fc4-7771d23cff66',
    'b1054aac-1e32-4d92-b641-5ab23b7a4174',
    '50abe5ec-690f-4dfe-90c9-00c1e045d831',
    'd8ae9a32-9c1a-49be-a288-c35ba124d395',
    '7126C8EF-1C57-476B-AB3A-E09DAE0E37D3',
    '915594ff-dc6c-42e1-8737-399c784f652e',
    '7a12686c-fcc6-4984-8f41-fa41d3036c63',
    '4436b199-616d-40ac-a8cc-728556e7d36b',
    '24ae9885-4a9f-42b9-85c1-a053dedd5a2b',
    '1b5f7d32-b4f7-4791-a919-15abcf66b09e',
    '4649ee99-5c78-455b-b32e-db679c78ead3',
    '933F1C87-5084-423D-BE28-3ED5DB316885',
    'c202fc32-c675-4f80-8903-9eaa1284acc3',
    'df89aa2b-3c0f-4383-aaad-b0349a4b7bb1',
    'B9A50D34-5467-4B58-A3DC-223CEBF956ED',
    '3d6a0e9c-f2e6-4f5e-911e-f352f4183431',
    '9c37f282-85f8-45b3-b124-76797efa08b4',
    '6E282403-3071-48BA-849F-C1EBF0F013F0',
    'da383c83-1644-414d-a6d7-428e9978ea67',
    'dbc5b832-802e-49bf-a64f-427198596cbb',
    'e4215a7c-6a0f-4f44-8ef4-4c9c4bb33272',
    '8aae6c15-d161-4e49-b9e9-031df8dd13cf',
    'e8d68d39-496a-496b-91ab-43ceb685818c',
    '8832AAFF-F2AE-44E8-876A-E1B1B305B48C',
    '6d685bc0-ac9d-40a8-bd39-c3df8f5dea9e',
    '213967bc-2278-41b5-b5cb-23abf5a24f61',
    '3d67e166-bcab-404e-af40-baa50d123c31',
    '8fec1a92-20c1-4604-9a9a-37f2c3b79693',
    'b905cc41-c84b-443c-b5a6-3fa4e4798f87',
    '0c2c2d6a-b87c-4108-b80f-47102d8342b2',
    '2f50e082-4b99-45a9-8ec5-85347ceb63c4',
    '5ba9f649-5e81-4adc-8722-f0f54a2b2f69',
    'ecac5bb8-ce34-4e8a-ab66-bc8747d0c720',
    '4ebebc08-623c-4d6f-9ca0-941af04d308d',
    '69ad19f4-4fc9-408d-9d3e-bbd2dbfce8ca',
    'c72e058b-66f6-405b-8190-b42cf7b8f157',
    'C2D94CAA-7B1A-4B3C-A918-4A58359B59D2',
    '55b22874-efdd-4b64-820b-84b65b299a1d',
    '500d717f-e9f4-4f90-9c02-fae0e40f456e',
]

def get_db_connection():
    """Connect to database."""
    db_url = os.getenv("REMOTE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL or REMOTE_DATABASE_URL must be set")
    
    if 'pgbouncer=true' in db_url:
        db_url = db_url.replace('?pgbouncer=true&connection_limit=1', '')
    
    return psycopg2.connect(db_url)

def main():
    print("=" * 70)
    print("MARK COUNTERAGENTS AS EMPLOYEES")
    print("=" * 70)
    print(f"Total UUIDs to update: {len(EMPLOYEE_UUIDS)}")
    print()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Normalize UUIDs to uppercase for consistency
        normalized_uuids = [uuid.upper() for uuid in EMPLOYEE_UUIDS]
        
        # Update is_emploee = true
        print("Updating is_emploee = true...")
        cur.execute("""
            UPDATE counteragents 
            SET is_emploee = true, updated_at = NOW()
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
        """, (normalized_uuids,))
        
        is_emploee_count = cur.rowcount
        print(f"✓ Updated {is_emploee_count} counteragents with is_emploee = true")
        
        # Update was_emploee = true (same UUIDs)
        print("\nUpdating was_emploee = true...")
        cur.execute("""
            UPDATE counteragents 
            SET was_emploee = true, updated_at = NOW()
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
        """, (normalized_uuids,))
        
        was_emploee_count = cur.rowcount
        print(f"✓ Updated {was_emploee_count} counteragents with was_emploee = true")
        
        # Commit changes
        conn.commit()
        
        # Verify
        print("\nVerifying updates...")
        cur.execute("""
            SELECT COUNT(*) 
            FROM counteragents 
            WHERE UPPER(counteragent_uuid::text) = ANY(%s) 
            AND is_emploee = true 
            AND was_emploee = true
        """, (normalized_uuids,))
        
        verified_count = cur.fetchone()[0]
        print(f"✓ Verified: {verified_count} counteragents have both flags set to true")
        
        # Show sample
        cur.execute("""
            SELECT name, counteragent_uuid, is_emploee, was_emploee
            FROM counteragents 
            WHERE UPPER(counteragent_uuid::text) = ANY(%s)
            LIMIT 5
        """, (normalized_uuids,))
        
        print("\nSample records:")
        for row in cur.fetchall():
            print(f"  - {row[0]}: {row[1]} | is_emploee={row[2]}, was_emploee={row[3]}")
        
        cur.close()
        conn.close()
        
        print("\n" + "=" * 70)
        print("UPDATE COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        
        if verified_count != len(EMPLOYEE_UUIDS):
            print(f"\n⚠ Warning: Expected {len(EMPLOYEE_UUIDS)} records but found {verified_count}")
            print("Some UUIDs may not exist in the database.")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
