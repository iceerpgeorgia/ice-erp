#!/usr/bin/env python3
"""
Import missing jobs from Jobs.csv to SUPABASE database
Only imports jobs whose UUIDs are not already in the database
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys

# Database connection (SUPABASE)
DATABASE_URL = "postgresql://postgres.fojbzghphznbslqwurrm:fulebimojviT1985%25@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

CSV_PATH = 'Jobs.csv'

print("=" * 80)
print("IMPORT MISSING JOBS FROM CSV TO SUPABASE")
print("=" * 80)

try:
    # Read CSV
    print(f"\n📄 Reading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    print(f"   Found {len(df)} records in CSV")
    
    # Clean data
    df['job_uuid'] = df['job_uuid'].str.strip().str.upper()
    df['project_uuid'] = df['project_uuid'].str.strip().str.upper()
    df['brand_uuid'] = df['brand_uuid'].fillna('').str.strip().str.upper()
    df['floors'] = pd.to_numeric(df['floors'], errors='coerce').fillna(0).astype(int)
    df['weight'] = pd.to_numeric(df['weight'], errors='coerce').fillna(0).astype(int)
    df['is_ff'] = df['is_ff'].fillna(False)
    
    # Convert TRUE/FALSE strings to boolean
    df['is_ff'] = df['is_ff'].apply(lambda x: str(x).strip().upper() == 'TRUE' if pd.notna(x) else False)
    
    # Connect to database
    print("\n🔌 Connecting to SUPABASE database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get existing job UUIDs
    print("\n🔍 Checking existing jobs in database...")
    cur.execute("SELECT job_uuid::text FROM jobs")
    existing_uuids = {row[0].upper() for row in cur.fetchall()}
    print(f"   Found {len(existing_uuids)} existing jobs in database")
    
    # Filter to only missing jobs
    missing_jobs = df[~df['job_uuid'].isin(existing_uuids)].copy()
    print(f"   Found {len(missing_jobs)} missing jobs to import")
    
    if len(missing_jobs) == 0:
        print("\n✅ All jobs from CSV already exist in database!")
        cur.close()
        conn.close()
        sys.exit(0)
    
    # Validate project UUIDs exist
    print("\n🔍 Validating project UUIDs...")
    project_uuids = missing_jobs['project_uuid'].unique().tolist()
    cur.execute("""
        SELECT project_uuid::text FROM projects 
        WHERE UPPER(project_uuid::text) = ANY(%s)
    """, (project_uuids,))
    valid_projects = {row[0].upper() for row in cur.fetchall()}
    
    invalid_projects = set(project_uuids) - valid_projects
    if invalid_projects:
        print(f"   ⚠️  Warning: {len(invalid_projects)} project UUIDs not found:")
        for uuid in list(invalid_projects)[:5]:
            print(f"      - {uuid}")
        
        # Filter out jobs with invalid projects
        missing_jobs = missing_jobs[missing_jobs['project_uuid'].isin(valid_projects)]
        print(f"   Proceeding with {len(missing_jobs)} jobs that have valid projects")
    else:
        print(f"   ✓ All project UUIDs are valid")
    
    if len(missing_jobs) == 0:
        print("\n⚠️  No valid jobs to import after validation")
        cur.close()
        conn.close()
        sys.exit(1)
    
    # Validate brand UUIDs (optional field)
    print("\n🔍 Validating brand UUIDs...")
    brand_jobs = missing_jobs[missing_jobs['brand_uuid'] != '']
    if len(brand_jobs) > 0:
        brand_uuids = brand_jobs['brand_uuid'].unique().tolist()
        cur.execute("""
            SELECT uuid::text FROM brands 
            WHERE UPPER(uuid::text) = ANY(%s)
        """, (brand_uuids,))
        valid_brands = {row[0].upper() for row in cur.fetchall()}
        
        invalid_brands = set(brand_uuids) - valid_brands
        if invalid_brands:
            print(f"   ⚠️  Warning: {len(invalid_brands)} brand UUIDs not found:")
            for uuid in list(invalid_brands)[:5]:
                print(f"      - {uuid}")
            
            # Set invalid brand UUIDs to NULL
            missing_jobs.loc[missing_jobs['brand_uuid'].isin(invalid_brands), 'brand_uuid'] = ''
            print(f"   Set invalid brand UUIDs to NULL")
        else:
            print(f"   ✓ All brand UUIDs are valid")
    
    # Prepare data for insertion
    print(f"\n📝 Preparing {len(missing_jobs)} jobs for insertion...")
    insert_data = []
    for _, row in missing_jobs.iterrows():
        brand_uuid = row['brand_uuid'] if row['brand_uuid'] != '' else None
        insert_data.append((
            row['job_uuid'],
            row['project_uuid'],
            row['job_name'],
            row['floors'],
            row['weight'],
            row['is_ff'],
            brand_uuid
        ))
    
    # Insert jobs
    print(f"\n💾 Inserting {len(insert_data)} jobs into database...")
    insert_query = """
        INSERT INTO jobs (job_uuid, project_uuid, job_name, floors, weight, is_ff, brand_uuid)
        VALUES %s
        ON CONFLICT (job_uuid) DO NOTHING
    """
    
    execute_values(cur, insert_query, insert_data)
    conn.commit()
    
    rows_inserted = cur.rowcount
    print(f"   ✅ Successfully inserted {rows_inserted} jobs")
    
    cur.close()
    conn.close()
    
    print("\n" + "=" * 80)
    print(f"✅ IMPORT COMPLETED SUCCESSFULLY")
    print(f"   Jobs imported: {rows_inserted}")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
