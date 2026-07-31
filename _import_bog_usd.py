import os
import psycopg2
from psycopg2.extras import execute_values
import pandas as pd
from datetime import datetime, timedelta
import json

# Database connection
DB_HOST = os.getenv('SUPABASE_DB_HOST', 'db.wlpzfmmwmqbhqsrfmlgg.supabase.co')
DB_USER = os.getenv('SUPABASE_DB_USER', 'postgres')
DB_PASSWORD = os.getenv('SUPABASE_DB_PASSWORD', 'Ice@Erp2024!')
DB_NAME = os.getenv('SUPABASE_DB_NAME', 'postgres')
DB_PORT = int(os.getenv('SUPABASE_DB_PORT', '5432'))

TABLE_NAME = 'GE78BG0000000893486000_BOG_USD'

def excel_date_to_datetime(excel_date):
    """Convert Excel serial date to Python datetime"""
    if pd.isna(excel_date):
        return None
    try:
        return datetime(1900, 1, 1) + timedelta(days=excel_date - 2)
    except:
        return None

def get_db_connection():
    """Establish database connection"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return None

def check_table_schema(conn):
    """Check the database table schema"""
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
    print(f"DATABASE TABLE SCHEMA: {TABLE_NAME}")
    print(f"{'=' * 100}")
    print(f"Total columns: {len(columns)}\n")
    
    schema = {}
    for i, (name, dtype, nullable) in enumerate(columns, 1):
        schema[name] = {'type': dtype, 'nullable': nullable == 'YES'}
        print(f"  {i:2d}. {name:40s} {dtype:20s} {'NULL' if nullable == 'YES' else 'NOT NULL'}")
    
    return schema

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

def load_and_prepare_excel():
    """Load Excel file and prepare for import"""
    print(f"\n{'=' * 100}")
    print("LOADING EXCEL FILE")
    print(f"{'=' * 100}")
    
    file_path = r'Chrome Logs\BOG USD 2018-2022.xlsx'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Sheet1')
        print(f"✓ Loaded Excel file: {len(df):,} rows")
        
        # Convert date from Excel serial format
        df['transaction_date'] = df['თარიღი'].apply(excel_date_to_datetime)
        
        print(f"✓ Excel date range: {df['transaction_date'].min().strftime('%Y-%m-%d')} to {df['transaction_date'].max().strftime('%Y-%m-%d')}")
        
        return df
    except Exception as e:
        print(f"❌ Failed to load Excel: {e}")
        return None

def prepare_insert_rows(df, existing_ids):
    """Prepare rows for insertion by filtering out duplicates"""
    print(f"\n{'=' * 100}")
    print("DEDUPLICATION")
    print(f"{'=' * 100}")
    
    print(f"Excel rows: {len(df):,}")
    print(f"Existing operation IDs: {len(existing_ids):,}")
    
    # Filter out rows with operation IDs already in database
    new_rows = df[~df['ოპერაციის იდ'].isin(existing_ids)].copy()
    
    duplicates = len(df) - len(new_rows)
    print(f"Duplicate rows (already in DB): {duplicates:,}")
    print(f"New rows to insert: {len(new_rows):,}")
    
    return new_rows

def insert_rows(conn, df_rows):
    """Insert rows into database"""
    if len(df_rows) == 0:
        print(f"\n✓ No new rows to insert")
        return 0
    
    print(f"\n{'=' * 100}")
    print("PREPARING INSERT STATEMENT")
    print(f"{'=' * 100}")
    
    cursor = conn.cursor()
    
    # Map Excel columns to database columns
    # Note: Based on typical bank statement table structure
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
    
    # Build insert statement - only include columns that exist in both Excel and DB
    db_columns = []
    excel_columns = []
    
    # Get list of columns that actually exist in the target table
    cursor.execute(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '{TABLE_NAME}'
    """)
    db_col_names = {row[0] for row in cursor.fetchall()}
    
    print(f"\nDatabase columns available: {len(db_col_names)}")
    
    # Build mapping of available columns
    for db_col, excel_col in column_mapping.items():
        if db_col in db_col_names and excel_col in df_rows.columns:
            db_columns.append(db_col)
            excel_columns.append(excel_col)
    
    print(f"Columns to insert: {len(db_columns)}")
    for db_col, excel_col in zip(db_columns, excel_columns):
        print(f"  {db_col:30s} <- {excel_col}")
    
    # Prepare values for insertion
    values = []
    for idx, row in df_rows.iterrows():
        row_values = []
        for excel_col in excel_columns:
            val = row[excel_col]
            # Convert NaN to None for database NULLs
            if pd.isna(val):
                row_values.append(None)
            else:
                row_values.append(val)
        values.append(tuple(row_values))
    
    print(f"\nPrepared {len(values)} rows for insertion")
    
    # Build and execute INSERT statement
    if values:
        placeholders = ','.join(['%s'] * len(db_columns))
        insert_sql = f"""
            INSERT INTO "{TABLE_NAME}" ({', '.join(db_columns)})
            VALUES %s
            ON CONFLICT (operation_id) DO NOTHING
        """
        
        try:
            execute_values(cursor, insert_sql, values, page_size=100)
            conn.commit()
            
            inserted = cursor.rowcount
            print(f"\n✓ Successfully inserted {inserted:,} rows")
            return inserted
            
        except Exception as e:
            conn.rollback()
            print(f"\n❌ Insertion failed: {e}")
            return 0
    
    cursor.close()
    return 0

def main():
    print("\n" + "=" * 100)
    print("BOG USD IMPORT: EXCEL TO DATABASE")
    print("=" * 100)
    
    # Connect to database
    conn = get_db_connection()
    if not conn:
        return
    
    try:
        # Check table schema
        schema = check_table_schema(conn)
        
        # Get existing operation IDs
        existing_ids = get_existing_operation_ids(conn)
        
        # Load and prepare Excel data
        df = load_and_prepare_excel()
        if df is None:
            return
        
        # Find new rows to insert
        new_rows = prepare_insert_rows(df, existing_ids)
        
        # Insert rows
        if len(new_rows) > 0:
            inserted = insert_rows(conn, new_rows)
            
            print(f"\n{'=' * 100}")
            print("IMPORT SUMMARY")
            print(f"{'=' * 100}")
            print(f"✓ Total inserted: {inserted:,} rows")
            print(f"✓ Date range: {new_rows['transaction_date'].min().strftime('%Y-%m-%d')} to {new_rows['transaction_date'].max().strftime('%Y-%m-%d')}")
            
            # Get updated count
            cursor = conn.cursor()
            cursor.execute(f"SELECT COUNT(*) FROM \"{TABLE_NAME}\"")
            new_total = cursor.fetchone()[0]
            cursor.close()
            
            print(f"✓ Table total rows: {new_total:,}")
        else:
            print(f"\n✓ No new rows to insert - all transactions already in database")
        
        print(f"\n{'=' * 100}")
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
