#!/usr/bin/env python3
"""
Copy projects data from Supabase to local database.
"""

import os
import psycopg2
from psycopg2.extras import execute_batch

# Load environment variables directly from .env file
def load_env_vars():
    """Load environment variables from .env and .env.local files."""
    env_vars = {}
    
    # Try .env first
    for env_file in ['.env', '.env.local']:
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_vars[key.strip()] = value.strip().strip('"').strip("'")
        except Exception as e:
            print(f"Warning: Could not load {env_file}: {e}")
    return env_vars

env_vars = load_env_vars()

# Database connections
SUPABASE_URL = (env_vars.get('SUPABASE_DATABASE_URL') or 
                env_vars.get('REMOTE_DATABASE_URL') or 
                os.getenv('SUPABASE_DATABASE_URL') or
                os.getenv('REMOTE_DATABASE_URL'))
LOCAL_URL = env_vars.get('DATABASE_URL') or os.getenv('DATABASE_URL')

if not SUPABASE_URL or not LOCAL_URL:
    print("Error: Missing database URLs in environment variables")
    print("Please ensure SUPABASE_DATABASE_URL and DATABASE_URL are set in .env file")
    exit(1)

# Clean up Supabase URL (remove pgbouncer parameters that psycopg2 doesn't support)
if 'pgbouncer' in SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.split('?')[0]
    print("Note: Removed pgbouncer parameters from Supabase URL")

# Clean up Local URL (remove schema parameter that psycopg2 doesn't support)
if 'schema=' in LOCAL_URL:
    LOCAL_URL = LOCAL_URL.split('?')[0]
    print("Note: Removed schema parameter from Local URL")

print(f"Local DB: {LOCAL_URL[:30]}...")
print(f"Supabase DB: {SUPABASE_URL[:40]}...")

def copy_projects():
    """Copy projects from Supabase to local."""
    
    print("Connecting to databases...")
    supabase_conn = psycopg2.connect(SUPABASE_URL)
    local_conn = psycopg2.connect(LOCAL_URL)
    
    supabase_cur = supabase_conn.cursor()
    local_cur = local_conn.cursor()
    
    try:
        # Get column names from both databases
        supabase_cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' 
            ORDER BY ordinal_position
        """)
        supabase_columns = set(row[0] for row in supabase_cur.fetchall())
        print(f"Supabase projects table has {len(supabase_columns)} columns")
        
        local_cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'projects' 
            ORDER BY ordinal_position
        """)
        local_columns = set(row[0] for row in local_cur.fetchall())
        print(f"Local projects table has {len(local_columns)} columns")
        
        # Only copy columns that exist in both databases
        common_columns = sorted(supabase_columns & local_columns)
        print(f"Copying {len(common_columns)} common columns: {', '.join(common_columns)}")
        
        # Fetch all projects from Supabase
        column_list = ', '.join(common_columns)
        supabase_cur.execute(f"SELECT {column_list} FROM projects ORDER BY project_uuid")
        projects = supabase_cur.fetchall()
        print(f"Fetched {len(projects)} projects from Supabase")
        
        if not projects:
            print("No projects found in Supabase")
            return
        
        # Clear existing projects in local database (cascade to delete related records)
        print("Clearing existing projects from local database...")
        local_cur.execute("TRUNCATE TABLE projects CASCADE")
        local_conn.commit()
        print(f"Deleted existing projects and related records")
        
        # Insert projects into local database
        print("Inserting projects into local database...")
        placeholders = ', '.join(['%s'] * len(common_columns))
        insert_query = f"INSERT INTO projects ({column_list}) VALUES ({placeholders})"
        
        execute_batch(local_cur, insert_query, projects, page_size=100)
        local_conn.commit()
        
        # Verify the copy
        local_cur.execute("SELECT COUNT(*) FROM projects")
        local_count = local_cur.fetchone()[0]
        
        print(f"\nCopy completed successfully!")
        print(f"Total projects copied: {local_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        local_conn.rollback()
        raise
    finally:
        supabase_cur.close()
        local_cur.close()
        supabase_conn.close()
        local_conn.close()

if __name__ == "__main__":
    copy_projects()
