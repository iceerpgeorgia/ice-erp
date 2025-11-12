#!/usr/bin/env python3
"""Sync NBG exchange rates to Google Sheets with support for direct, inverse, and cross rates."""

import os
import psycopg2
from datetime import datetime, timedelta
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from typing import List, Dict, Tuple, Optional

# Configuration
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', 'YOUR_SPREADSHEET_ID_HERE')
SHEET_NAME = os.getenv('SHEET_NAME', 'NBG Rates')
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'service-account-nbg.json')

# Google Sheets API setup
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Currency mapping for NBG database
CURRENCY_CODES = {
    'USD': 'usd_rate',
    'EUR': 'eur_rate',
    'CNY': 'cny_rate',
    'GBP': 'gbp_rate',
    'RUB': 'rub_rate',
    'TRY': 'try_rate',
    'AED': 'aed_rate',
    'KZT': 'kzt_rate',
    'GEL': None  # GEL is the base currency
}


def get_database_connection():
    """Connect to Supabase PostgreSQL database."""
    db_url = os.getenv("REMOTE_DATABASE_URL")
    if not db_url:
        raise ValueError("REMOTE_DATABASE_URL environment variable not set")
    # Keep pooler port 6543, just remove pgbouncer parameter
    db_url = db_url.replace('?pgbouncer=true&connection_limit=1', '')
    return psycopg2.connect(db_url)


def get_google_sheets_service():
    """Initialize Google Sheets API service."""
    creds = Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('sheets', 'v4', credentials=creds)
    return service


def parse_date_from_gs(date_str: str) -> datetime:
    """Parse date from Google Sheets (dd.mm.yyyy format)."""
    return datetime.strptime(date_str, "%d.%m.%Y")


def format_date_for_gs(date_obj: datetime) -> str:
    """Format date for Google Sheets (dd.mm.yyyy format)."""
    return date_obj.strftime("%d.%m.%Y")


def parse_rate_pair(header: str) -> Tuple[str, str]:
    """
    Parse rate pair from header like 'USD/GEL' or 'EUR/USD'.
    Returns (from_currency, to_currency).
    Example: 'USD/GEL' returns ('USD', 'GEL') - how much GEL is 1 USD.
    """
    parts = header.split('/')
    if len(parts) != 2:
        raise ValueError(f"Invalid header format: {header}. Expected format: CUR1/CUR2")
    return parts[0].strip().upper(), parts[1].strip().upper()


def calculate_rate(from_curr: str, to_curr: str, rates: Dict[str, float]) -> Optional[float]:
    """
    Calculate exchange rate from from_curr to to_curr.
    
    Args:
        from_curr: Source currency code
        to_curr: Target currency code
        rates: Dictionary with currency rates to GEL
    
    Returns:
        Exchange rate or None if cannot be calculated
    
    Examples:
        - USD/GEL: Direct rate from NBG (how much GEL is 1 USD)
        - GEL/USD: Inverse rate = 1 / usd_rate (how much USD is 1 GEL)
        - EUR/USD: Cross rate = eur_rate / usd_rate (how much USD is 1 EUR)
    """
    # Direct rate: X/GEL (how much GEL is 1 X)
    if to_curr == 'GEL':
        if from_curr == 'GEL':
            return 1.0
        return rates.get(from_curr)
    
    # Inverse rate: GEL/X (how much X is 1 GEL)
    if from_curr == 'GEL':
        rate = rates.get(to_curr)
        if rate and rate > 0:
            return 1.0 / rate
        return None
    
    # Cross rate: X/Y (how much Y is 1 X)
    # Formula: rate_from / rate_to
    # Example: EUR/USD = eur_rate / usd_rate
    rate_from = rates.get(from_curr)
    rate_to = rates.get(to_curr)
    
    if rate_from and rate_to and rate_to > 0:
        return rate_from / rate_to
    
    return None


def get_sheet_headers(service, spreadsheet_id: str, sheet_name: str) -> List[str]:
    """Get headers from the first row of the sheet."""
    range_name = f"{sheet_name}!A1:Z1"
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()
    
    values = result.get('values', [])
    if not values:
        raise ValueError(f"No headers found in sheet '{sheet_name}'")
    
    return values[0]


def get_existing_dates(service, spreadsheet_id: str, sheet_name: str) -> set:
    """Get all existing dates from the first column of the sheet."""
    range_name = f"{sheet_name}!A2:A"  # Skip header row
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()
    
    values = result.get('values', [])
    existing_dates = set()
    
    for row in values:
        if row and row[0]:
            try:
                date_obj = parse_date_from_gs(row[0])
                existing_dates.add(date_obj.date())
            except ValueError:
                continue
    
    return existing_dates


def get_nbg_rates_from_db(conn, start_date: datetime, end_date: datetime) -> Dict[datetime, Dict[str, float]]:
    """
    Fetch NBG rates from database for the date range.
    
    Returns:
        Dictionary: {date: {currency_code: rate}}
    """
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT date, usd_rate, eur_rate, cny_rate, gbp_rate, 
               rub_rate, try_rate, aed_rate, kzt_rate
        FROM nbg_exchange_rates
        WHERE date >= %s AND date <= %s
        ORDER BY date
    """, (start_date.date(), end_date.date()))
    
    rates_by_date = {}
    
    for row in cursor.fetchall():
        date = row[0]
        rates_by_date[date] = {
            'USD': float(row[1]) if row[1] else None,
            'EUR': float(row[2]) if row[2] else None,
            'CNY': float(row[3]) if row[3] else None,
            'GBP': float(row[4]) if row[4] else None,
            'RUB': float(row[5]) if row[5] else None,
            'TRY': float(row[6]) if row[6] else None,
            'AED': float(row[7]) if row[7] else None,
            'KZT': float(row[8]) if row[8] else None,
        }
    
    cursor.close()
    return rates_by_date


def build_rows_to_insert(headers: List[str], missing_dates: List[datetime], 
                         rates_by_date: Dict[datetime, Dict[str, float]]) -> List[List]:
    """
    Build rows to insert into Google Sheets.
    
    Args:
        headers: Column headers from the sheet
        missing_dates: List of dates that need to be added
        rates_by_date: NBG rates data from database
    
    Returns:
        List of rows, each row is a list of values
    """
    rows = []
    
    for date in missing_dates:
        date_key = date.date()
        
        if date_key not in rates_by_date:
            print(f"  ⚠ Warning: No NBG data for {date_key}, skipping")
            continue
        
        rates = rates_by_date[date_key]
        row = [format_date_for_gs(date)]  # First column is date
        
        # Process each header column (skip first which is 'Date')
        for header in headers[1:]:
            try:
                from_curr, to_curr = parse_rate_pair(header)
                rate = calculate_rate(from_curr, to_curr, rates)
                
                if rate is not None:
                    row.append(round(rate, 6))
                else:
                    row.append("")
                    print(f"  ⚠ Warning: Could not calculate {header} for {date_key}")
            except ValueError as e:
                print(f"  ⚠ Warning: {e}")
                row.append("")
        
        rows.append(row)
    
    return rows


def append_rows_to_sheet(service, spreadsheet_id: str, sheet_name: str, rows: List[List]):
    """Append rows to the Google Sheet."""
    if not rows:
        print("No rows to insert")
        return
    
    range_name = f"{sheet_name}!A:Z"
    body = {
        'values': rows
    }
    
    result = service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption='RAW',
        insertDataOption='INSERT_ROWS',
        body=body
    ).execute()
    
    print(f"✓ Inserted {result.get('updates').get('updatedRows')} rows")


def sort_sheet_by_date(service, spreadsheet_id: str, sheet_name: str):
    """Sort the sheet by date column (ascending)."""
    # Get sheet ID
    sheet_metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheets = sheet_metadata.get('sheets', [])
    sheet_id = None
    
    for sheet in sheets:
        if sheet['properties']['title'] == sheet_name:
            sheet_id = sheet['properties']['sheetId']
            break
    
    if sheet_id is None:
        print(f"⚠ Warning: Could not find sheet ID for '{sheet_name}'")
        return
    
    # Sort request
    requests = [{
        'sortRange': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 1,  # Skip header
            },
            'sortSpecs': [{
                'dimensionIndex': 0,  # First column (Date)
                'sortOrder': 'ASCENDING'
            }]
        }
    }]
    
    body = {'requests': requests}
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    print("✓ Sorted sheet by date")


def main():
    """Main sync function."""
    print("="*70)
    print("SYNC NBG RATES TO GOOGLE SHEETS")
    print("="*70)
    print(f"Started at: {datetime.now()}")
    print(f"Spreadsheet ID: {SPREADSHEET_ID}")
    print(f"Sheet Name: {SHEET_NAME}")
    print()
    
    try:
        # Connect to database
        print("Connecting to Supabase...")
        conn = get_database_connection()
        print("✓ Connected to Supabase")
        
        # Initialize Google Sheets API
        print("Initializing Google Sheets API...")
        service = get_google_sheets_service()
        print("✓ Connected to Google Sheets")
        
        # Get headers from sheet
        print(f"\nReading headers from sheet '{SHEET_NAME}'...")
        headers = get_sheet_headers(service, SPREADSHEET_ID, SHEET_NAME)
        print(f"✓ Found {len(headers)} columns: {', '.join(headers)}")
        
        # Validate first column is 'Date'
        if headers[0].lower() != 'date':
            raise ValueError(f"First column must be 'Date', found: {headers[0]}")
        
        # Get existing dates from sheet
        print("\nFetching existing dates from sheet...")
        existing_dates = get_existing_dates(service, SPREADSHEET_ID, SHEET_NAME)
        print(f"✓ Found {len(existing_dates)} existing dates in sheet")
        if existing_dates:
            print(f"  Date range: {min(existing_dates)} to {max(existing_dates)}")
        
        # Get all dates from database
        print("\nFetching NBG data from database...")
        cursor = conn.cursor()
        cursor.execute("SELECT MIN(date), MAX(date) FROM nbg_exchange_rates")
        db_min_date, db_max_date = cursor.fetchone()
        
        if not db_min_date or not db_max_date:
            raise ValueError("No data found in nbg_exchange_rates table")
        
        print(f"✓ Database date range: {db_min_date} to {db_max_date}")
        
        # Find missing dates
        print("\nIdentifying missing dates...")
        current_date = datetime.combine(db_min_date, datetime.min.time())
        end_date = datetime.combine(db_max_date, datetime.min.time())
        
        missing_dates = []
        while current_date <= end_date:
            if current_date.date() not in existing_dates:
                missing_dates.append(current_date)
            current_date += timedelta(days=1)
        
        print(f"✓ Found {len(missing_dates)} missing dates")
        
        if not missing_dates:
            print("\n✓ Sheet is already up to date!")
            conn.close()
            return 0
        
        print(f"  First missing: {missing_dates[0].date()}")
        print(f"  Last missing: {missing_dates[-1].date()}")
        
        # Fetch NBG rates for missing dates
        print("\nFetching NBG rates for missing dates...")
        rates_by_date = get_nbg_rates_from_db(conn, missing_dates[0], missing_dates[-1])
        print(f"✓ Fetched rates for {len(rates_by_date)} dates")
        
        # Build rows to insert
        print("\nBuilding rows to insert...")
        rows = build_rows_to_insert(headers, missing_dates, rates_by_date)
        print(f"✓ Built {len(rows)} rows")
        
        # Insert rows
        print("\nInserting rows into Google Sheets...")
        append_rows_to_sheet(service, SPREADSHEET_ID, SHEET_NAME, rows)
        
        # Sort sheet by date
        print("\nSorting sheet by date...")
        sort_sheet_by_date(service, SPREADSHEET_ID, SHEET_NAME)
        
        # Close database connection
        conn.close()
        
        print("\n" + "="*70)
        print("SYNC COMPLETED SUCCESSFULLY!")
        print("="*70)
        print(f"Finished at: {datetime.now()}")
        print(f"Inserted {len(rows)} new rows")
        
    except Exception as e:
        print(f"\n✗ Error during sync: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
