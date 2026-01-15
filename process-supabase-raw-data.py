"""
Run backparse on Supabase (production) database.
Processes raw BOG GEL data and creates consolidated records directly on Supabase.
"""
import os
import sys

# Set environment to Vercel/Production mode
os.environ['VERCEL'] = '1'

# Import the main script
from import_bank_xml_data import backparse_bog_gel, get_db_connections

def main():
    print("🚀 PROCESSING RAW DATA ON SUPABASE (PRODUCTION MODE)")
    print("=" * 80)
    print()
    
    # Get Supabase connections (both will point to Supabase in Vercel mode)
    remote_conn, local_conn = get_db_connections()
    
    try:
        # Run backparse - this will process raw data on Supabase
        backparse_bog_gel(remote_conn, local_conn, clear_first=True)
        
        print("\n✅ Successfully processed raw data on Supabase!")
        
    finally:
        remote_conn.close()
        if local_conn != remote_conn:
            local_conn.close()

if __name__ == "__main__":
    main()
