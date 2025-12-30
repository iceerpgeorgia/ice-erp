import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

remote_url = os.getenv('REMOTE_DATABASE_URL')
if '?pgbouncer=' in remote_url:
    remote_url = remote_url.split('?')[0]

try:
    conn = psycopg2.connect(remote_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get table schema
    cur.execute("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_name = 'bog_gel_raw_893486000'
        AND table_schema = 'public'
        ORDER BY ordinal_position
    """)
    
    columns = cur.fetchall()
    
    print("CREATE TABLE bog_gel_raw_893486000 (")
    col_defs = []
    for col in columns:
        name = col['column_name']
        dtype = col['data_type']
        nullable = col['is_nullable']
        default = col['column_default']
        max_len = col['character_maximum_length']
        
        # Map data types
        if dtype == 'character varying':
            if max_len:
                col_def = f'  "{name}" VARCHAR({max_len})'
            else:
                col_def = f'  "{name}" VARCHAR'
        elif dtype == 'uuid':
            col_def = f'  "{name}" UUID'
        elif dtype == 'boolean':
            col_def = f'  "{name}" BOOLEAN'
        elif dtype == 'bigint':
            col_def = f'  "{name}" BIGINT'
        elif dtype == 'integer':
            col_def = f'  "{name}" INTEGER'
        elif dtype == 'numeric':
            col_def = f'  "{name}" NUMERIC'
        elif dtype == 'timestamp without time zone':
            col_def = f'  "{name}" TIMESTAMP'
        elif dtype == 'date':
            col_def = f'  "{name}" DATE'
        else:
            col_def = f'  "{name}" {dtype.upper()}'
        
        # Add default
        if default:
            # Clean up default value
            if 'uuid_generate' in default:
                default = 'uuid_generate_v4()'
            elif 'now()' in default:
                default = 'now()'
            elif 'nextval' in default:
                default = 'nextval(\'bog_gel_raw_893486000_id_seq\'::regclass)'
            col_def += f' DEFAULT {default}'
        
        # Add nullable
        if nullable == 'NO':
            col_def += ' NOT NULL'
        
        col_defs.append(col_def)
    
    print(',\n'.join(col_defs))
    print(");")
    
    # Check for primary key
    cur.execute("""
        SELECT a.attname
        FROM   pg_index i
        JOIN   pg_attribute a ON a.attrelid = i.indrelid
                             AND a.attnum = ANY(i.indkey)
        WHERE  i.indrelid = 'bog_gel_raw_893486000'::regclass
        AND    i.indisprimary
    """)
    pk = cur.fetchall()
    if pk:
        pk_cols = ', '.join([f'"{row["attname"]}"' for row in pk])
        print(f"\nALTER TABLE bog_gel_raw_893486000 ADD PRIMARY KEY ({pk_cols});")
    
    cur.close()
    conn.close()

except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
