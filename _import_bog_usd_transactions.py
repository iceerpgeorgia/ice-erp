#!/usr/bin/env python3
"""
Import BOG USD 2018-2022 transactions from Excel to Supabase
Uses DATABASE_URL from environment
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
from datetime import datetime, timedelta
from urllib.parse import urlparse

TABLE_NAME = 'GE78BG0000000893486000_BOG_USD'

def excel_date_to_datetime(excel_date):
    """Convert Excel serial date to Python datetime"""
    if pd.isna(excel_date):
        return None
    try:
        return datetime(1900, 1, 1) + timedelta(days=excel_date - 2)
    except:
        return None

def parse_database_url(db_url):
    """Parse DATABASE_URL and extract connection params"""
    parsed = urlparse(db_url)
    
    return {
        'host': parsed.hostname,
        'port': parsed.port or 5432,
        'user': parsed.username,
        'password': parsed.password,
        'database': parsed.path.lstrip('/')
    }

def get_db_connection():
    """Establish database connection"""
    try:
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("❌ DATABASE_URL environment variable not set")
            return None
        
        params = parse_database_url(db_url)
        
        print(f"Connecting to {params['host']}:{params['port']}/{params['database']}...")
        
        conn = psycopg2.connect(
            host=params['host'],
            port=params['port'],
            user=params['user'],
            password=params['password'],
            database=params['database'],
            sslmode='require'
        )
        
        print("✓ Connected to database")
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def check_table_exists(conn):
    """Check if the table exists"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = '{TABLE_NAME}'
        );
    """)
    
    exists = cursor.fetchone()[0]
    cursor.close()
    
    return exists

def get_table_schema(conn):
    """Get the database table schema"""
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = '{TABLE_NAME}'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    cursor.close()
    
    print(f"\n{'=' * 100}")
    print(f"DATABASE TABLE: {TABLE_NAME}")
    print(f"{'=' * 100}")
    print(f"Total columns: {len(columns)}\n")
    
    schema = {}
    for i, (name, dtype, nullable) in enumerate(columns, 1):
        schema[name] = {'type': dtype, 'nullable': nullable == 'YES'}
        print(f"  {i:2d}. {name:40s} {dtype:20s} {'NULL' if nullable == 'YES' else 'NOT NULL'}")
    
    return schema, {col[0] for col in columns}

def get_existing_operation_ids(conn):
    """Get all operation IDs already in the database"""
    cursor = conn.cursor()
    cursor.execute(f"SELECT DISTINCT operation_id FROM \"{TABLE_NAME}\" WHERE operation_id IS NOT NULL;")
    
    existing_ids = set()
    for row in cursor.fetchall():
        existing_ids.add(row[0])
    
    cursor.close()
    print(f"\n✓ Found {len(existing_ids):,} existing operation IDs in database")
    return existing_ids

def load_excel():
    """Load Excel file"""
    print(f"\n{'=' * 100}")
    print("LOADING EXCEL FILE")
    print(f"{'=' * 100}")
    
    file_path = r'Chrome Logs\BOG USD 2018-2022.xlsx'
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return None
    
    try:
        df = pd.read_excel(file_path, sheet_name='Sheet1')
        print(f"✓ Loaded {len(df):,} rows from Excel")
        
        # Convert date from Excel serial format
        df['transaction_date'] = df['თარიღი'].apply(excel_date_to_datetime)
        
        date_min = df['transaction_date'].min()
        date_max = df['transaction_date'].max()
        print(f"✓ Date range: {date_min.strftime('%Y-%m-%d')} to {date_max.strftime('%Y-%m-%d')}")
        
        return df
    except Exception as e:
        print(f"❌ Failed to load Excel: {e}")
        return None

def prepare_insert_data(df, existing_ids, db_columns):
    """Prepare data for insertion"""
    print(f"\n{'=' * 100}")
    print("PREPARING DATA FOR INSERT")
    print(f"{'=' * 100}")
    
    print(f"Total rows in Excel: {len(df):,}")
    print(f"Existing operation IDs in DB: {len(existing_ids):,}")
    
    # Filter out duplicates
    new_rows = df[~df['ოპერაციის იდ'].isin(existing_ids)].copy()
    
    duplicates = len(df) - len(new_rows)
    print(f"Duplicate rows (already in DB): {duplicates:,}")
    print(f"New rows to insert: {len(new_rows):,}")
    
    if len(new_rows) == 0:
        return None
    
    # Column mapping: DB column <- Excel column
    column_mapping = {
        'transaction_date': 'transaction_date',
        'document_number': 'საბუთის N',
        'correspondent_account': 'მოკორესპოდენტო ანგარიში',
        'debit_amount': 'დებეტი',
        'credit_amount': 'კრედიტი',
        'exchange_rate': 'კურსი',
        'debit_gel': 'დებეტი ექვ ლარში',
        'credit_gel': 'კრედიტი ექვ ლარში',
        'operation_description': 'ოპერაციის შინაარსი',
        'operation_type': 'ოპერაციის ტიპი',
        'operation_id': 'ოპერაციის იდ',
        'ref': 'Ref',
        'sender_name': 'გამგზავნის დასახელება',
        'sender_inn': 'გამგზავნის საიდენტიფიკაციო კოდი',
        'sender_account': 'გამგზავნის ანგარიშის ნომერი',
        'sender_bank_code': 'გამგზავნი ბანკის კოდი',
        'sender_bank_name': 'გამგზავნი ბანკის დასახელება',
        'beneficiary_name': 'მიმღების დასახელება',
        'beneficiary_inn': 'მიმღების საიდენტიფიკაციო კოდი',
        'beneficiary_account': 'მიმღების ანგარიშის ნომერი',
        'beneficiary_bank_code': 'მიმღები ბანკის კოდი',
        'beneficiary_bank_name': 'მიმღები ბანკის დასახელება',
        'purpose': 'დანიშნულება',
        'additional_info': 'დამატებითი ინფორმაცია',
        'amount': 'თანხა',
        'amount_gel': 'თანხა ექვ ლარში',
    }
    
    # Find columns that exist in both Excel and DB
    db_columns_insert = []
    excel_columns_insert = []
    
    for db_col, excel_col in column_mapping.items():
        if db_col in db_columns and excel_col in new_rows.columns:
            db_columns_insert.append(db_col)
            excel_columns_insert.append(excel_col)
    
    print(f"\nColumns to insert: {len(db_columns_insert)}")
    for db_col, excel_col in zip(db_columns_insert, excel_columns_insert):
        print(f"  {db_col:30s} <- {excel_col}")
    
    # Prepare values
    values = []
    for idx, row in new_rows.iterrows():
        row_values = []
        for excel_col in excel_columns_insert:
            val = row[excel_col]
            row_values.append(None if pd.isna(val) else val)
        values.append(tuple(row_values))
    
    return {
        'columns': db_columns_insert,
        'values': values,
        'new_rows_df': new_rows
    }

def execute_insert(conn, insert_data):
    """Execute the insert statement"""
    if insert_data is None or not insert_data['values']:
        print("\n✓ No new rows to insert")
        return 0
    
    print(f"\n{'=' * 100}")
    print("INSERTING DATA")
    print(f"{'=' * 100}")
    
    cursor = conn.cursor()
    db_columns = insert_data['columns']
    values = insert_data['values']
    
    placeholders = ','.join(['%s'] * len(db_columns))
    insert_sql = f"""
        INSERT INTO "{TABLE_NAME}" ({', '.join(db_columns)})
        VALUES %s
        ON CONFLICT (operation_id) DO NOTHING
    """
    
    try:
        print(f"Inserting {len(values):,} rows...")
        execute_values(cursor, insert_sql, values, page_size=100)
        conn.commit()
        
        inserted = cursor.rowcount
        print(f"✓ Successfully inserted {inserted:,} rows")
        return inserted
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Insertion failed: {e}")
        import traceback
        traceback.print_exc()
        return 0
    finally:
        cursor.close()

def print_summary(conn, inserted_count):
    """Print import summary"""
    print(f"\n{'=' * 100}")
    print("IMPORT SUMMARY")
    print(f"{'=' * 100}")
    print(f"✓ Rows inserted: {inserted_count:,}")
    
    # Get updated row count
    cursor = conn.cursor()
    cursor.execute(f"SELECT COUNT(*) FROM \"{TABLE_NAME}\"")
    total_rows = cursor.fetchone()[0]
    cursor.close()
    
    print(f"✓ Table total rows: {total_rows:,}")
    print(f"\n✓ Import completed successfully!")

def main():
    print("\n" + "=" * 100)
    print("BOG USD TRANSACTION IMPORT")
    print("Source: Chrome Logs\\BOG USD 2018-2022.xlsx")
    print(f"Target: {TABLE_NAME}")
    print("=" * 100)
    
    # Connect to database
    conn = get_db_connection()
    if not conn:
        return 1
    
    try:
        # Check if table exists
        if not check_table_exists(conn):
            print(f"❌ Table {TABLE_NAME} does not exist")
            return 1
        
        # Get table schema
        schema, db_columns = get_table_schema(conn)
        
        # Get existing operation IDs
        existing_ids = get_existing_operation_ids(conn)
        
        # Load Excel data
        df = load_excel()
        if df is None:
            return 1
        
        # Prepare insert data
        insert_data = prepare_insert_data(df, existing_ids, db_columns)
        
        # Execute insert
        inserted = execute_insert(conn, insert_data)
        
        # Print summary
        print_summary(conn, inserted)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        conn.close()

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
