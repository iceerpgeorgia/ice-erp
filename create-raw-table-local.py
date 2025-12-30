import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

local_url = os.getenv('DATABASE_URL')
if '?schema=' in local_url:
    local_url = local_url.split('?schema=')[0]

try:
    conn = psycopg2.connect(local_url)
    cur = conn.cursor()
    
    print("Creating bog_gel_raw_893486000 table...")
    
    # First create sequence
    cur.execute("""
        CREATE SEQUENCE IF NOT EXISTS bog_gel_raw_893486000_id_seq
    """)
    
    # Create table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS bog_gel_raw_893486000 (
          id BIGINT DEFAULT nextval('bog_gel_raw_893486000_id_seq'::regclass) NOT NULL,
          uuid UUID NOT NULL,
          cancopydocument TEXT,
          canviewdocument TEXT,
          canprintdocument TEXT,
          isreval TEXT,
          docnomination TEXT,
          docinformation TEXT,
          docsrcamt TEXT,
          docsrcccy TEXT,
          docdstamt TEXT,
          docdstccy TEXT,
          dockey TEXT,
          docrecdate TEXT,
          docbranch TEXT,
          docdepartment TEXT,
          docprodgroup TEXT,
          docno TEXT,
          docvaluedate TEXT,
          docsendername TEXT,
          docsenderinn TEXT,
          docsenderacctno TEXT,
          docsenderbic TEXT,
          docactualdate TEXT,
          doccoracct TEXT,
          doccorbic TEXT,
          doccorbankname TEXT,
          entriesid TEXT,
          doccomment TEXT,
          ccyrate TEXT,
          entrypdate TEXT,
          entrydocno TEXT,
          entrylacct TEXT,
          entrylacctold TEXT,
          entrydbamt TEXT,
          entrydbamtbase TEXT,
          entrycramt TEXT,
          entrycramtbase TEXT,
          outbalance TEXT,
          entryamtbase TEXT,
          entrycomment TEXT,
          entrydepartment TEXT,
          entryacctpoint TEXT,
          docsenderbicname TEXT,
          docbenefname TEXT,
          docbenefinn TEXT,
          docbenefacctno TEXT,
          docbenefbic TEXT,
          docbenefbicname TEXT,
          docpayername TEXT,
          docpayerinn TEXT,
          import_batch_id TEXT,
          import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          is_processed BOOLEAN DEFAULT false NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY (id)
        )
    """)
    
    conn.commit()
    
    # Verify
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_name = 'bog_gel_raw_893486000'
    """)
    count = cur.fetchone()[0]
    
    if count > 0:
        print("✅ Table created successfully!")
    else:
        print("❌ Table was not created")
    
    cur.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
