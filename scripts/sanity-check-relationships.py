#!/usr/bin/env python3
"""
Sanity Check Script - Validates database integrity

This script checks for:
1. Orphaned records (UUIDs that reference non-existent parent records)
2. Missing relationships
3. NULL values in mandatory (NOT NULL) columns

RELATIONSHIPS TO CHECK:
1. Counteragents -> Countries (country_uuid)
2. Counteragents -> EntityTypes (entity_type_uuid)
3. FinancialCodes -> FinancialCodes (parentUuid - self-referential)
4. Transactions -> FinancialCodes (financialCodeId)
5. Transactions -> Counteragents (counteragentId)
6. Projects -> Counteragents (counteragentId)
7. Projects -> FinancialCodes (financialCodeId)
8. Projects -> Users (employeeId)

TODO: Update this list when new relationships are added!
"""

import psycopg2
import os
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

# Define all relationships to check
# Format: {
#   'name': 'Display name',
#   'child_table': 'table with foreign key',
#   'child_column': 'foreign key column',
#   'parent_table': 'referenced table',
#   'parent_column': 'referenced column',
#   'nullable': True/False (whether NULL is allowed)
# }
RELATIONSHIPS = [
    {
        'name': 'Counteragents → Countries',
        'child_table': 'counteragents',
        'child_column': 'country_uuid',
        'parent_table': 'countries',
        'parent_column': 'country_uuid',
        'nullable': True
    },
    {
        'name': 'Counteragents → EntityTypes',
        'child_table': 'counteragents',
        'child_column': 'entity_type_uuid',
        'parent_table': 'entity_types',
        'parent_column': 'entity_type_uuid',
        'nullable': True
    },
    {
        'name': 'FinancialCodes → FinancialCodes (parent)',
        'child_table': 'financial_codes',
        'child_column': 'parent_uuid',
        'parent_table': 'financial_codes',
        'parent_column': 'uuid',
        'nullable': True,
        'self_referential': True
    },
    {
        'name': 'Transactions → FinancialCodes',
        'child_table': 'transactions',
        'child_column': 'financial_code_id',
        'child_id_column': 'id',
        'parent_table': 'financial_codes',
        'parent_column': 'id',
        'nullable': False,
        'id_based': True  # Uses BigInt ID instead of UUID
    },
    {
        'name': 'Transactions → Counteragents',
        'child_table': 'transactions',
        'child_column': 'counteragent_id',
        'child_id_column': 'id',
        'parent_table': 'counteragents',
        'parent_column': 'id',
        'nullable': True,
        'id_based': True
    },
    {
        'name': 'Projects → Counteragents',
        'child_table': 'projects',
        'child_column': 'counteragent_id',
        'child_id_column': 'id',
        'parent_table': 'counteragents',
        'parent_column': 'id',
        'nullable': False,
        'id_based': True
    },
    {
        'name': 'Projects → FinancialCodes',
        'child_table': 'projects',
        'child_column': 'financial_code_id',
        'child_id_column': 'id',
        'parent_table': 'financial_codes',
        'parent_column': 'id',
        'nullable': False,
        'id_based': True
    },
    {
        'name': 'Projects → Users (employee)',
        'child_table': 'projects',
        'child_column': 'employee_id',
        'child_id_column': 'uuid',
        'parent_table': '"User"',  # Quoted because it's capitalized
        'parent_column': 'id',
        'nullable': True,
        'id_based': False  # Uses String (cuid)
    },
]

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def check_relationship(cur, rel):
    """Check a single relationship for orphaned records"""
    
    child_table = rel['child_table']
    child_column = rel['child_column']
    parent_table = rel['parent_table']
    parent_column = rel['parent_column']
    nullable = rel.get('nullable', False)
    is_id_based = rel.get('id_based', False)
    
    # Get child ID column for reporting
    child_id_col = rel.get('child_id_column', 'id')
    
    # Count total records in child table
    cur.execute(f"SELECT COUNT(*) FROM {child_table}")
    total_children = cur.fetchone()[0]
    
    # Count non-null foreign keys
    cur.execute(f"SELECT COUNT(*) FROM {child_table} WHERE {child_column} IS NOT NULL")
    non_null_fks = cur.fetchone()[0]
    
    # Count null foreign keys (if allowed)
    null_fks = total_children - non_null_fks
    
    # Find orphaned records (FKs that don't exist in parent table)
    if rel.get('self_referential'):
        # Special case: self-referential (parent_uuid must not equal own uuid)
        query = f"""
            SELECT c.{child_id_col}, c.{child_column}
            FROM {child_table} c
            WHERE c.{child_column} IS NOT NULL
              AND c.{child_column} != c.uuid
              AND NOT EXISTS (
                SELECT 1 FROM {parent_table} p 
                WHERE p.{parent_column} = c.{child_column}
              )
        """
    elif is_id_based:
        # ID-based relationships (BigInt or String IDs, not UUIDs)
        query = f"""
            SELECT c.{child_id_col}, c.{child_column}
            FROM {child_table} c
            WHERE c.{child_column} IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM {parent_table} p 
                WHERE CAST(p.{parent_column} AS TEXT) = CAST(c.{child_column} AS TEXT)
              )
        """
    else:
        query = f"""
            SELECT c.{child_id_col}, c.{child_column}
            FROM {child_table} c
            WHERE c.{child_column} IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM {parent_table} p 
                WHERE p.{parent_column} = c.{child_column}
              )
        """
    
    cur.execute(query)
    orphaned = cur.fetchall()
    
    return {
        'total_children': total_children,
        'non_null_fks': non_null_fks,
        'null_fks': null_fks,
        'orphaned_count': len(orphaned),
        'orphaned_records': orphaned[:5]  # First 5 for reporting
    }

def check_mandatory_columns(cur):
    """Check for NULL values in NOT NULL columns"""
    
    # Get all tables and their NOT NULL columns
    cur.execute("""
        SELECT 
            c.table_name,
            c.column_name,
            c.data_type
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.is_nullable = 'NO'
          AND c.column_default IS NULL  -- Exclude columns with defaults
          AND c.table_name NOT IN ('_prisma_migrations')  -- Skip internal tables
        ORDER BY c.table_name, c.ordinal_position
    """)
    
    mandatory_columns = {}
    for table_name, column_name, data_type in cur.fetchall():
        if table_name not in mandatory_columns:
            mandatory_columns[table_name] = []
        mandatory_columns[table_name].append((column_name, data_type))
    
    results = []
    
    for table_name, columns in mandatory_columns.items():
        for column_name, data_type in columns:
            # Check for NULL values
            try:
                cur.execute(f"""
                    SELECT COUNT(*) 
                    FROM {table_name} 
                    WHERE {column_name} IS NULL
                """)
                null_count = cur.fetchone()[0]
                
                if null_count > 0:
                    # Get sample records
                    cur.execute(f"""
                        SELECT id 
                        FROM {table_name} 
                        WHERE {column_name} IS NULL 
                        LIMIT 5
                    """)
                    sample_ids = [row[0] for row in cur.fetchall()]
                    
                    results.append({
                        'table': table_name,
                        'column': column_name,
                        'data_type': data_type,
                        'null_count': null_count,
                        'sample_ids': sample_ids
                    })
            except psycopg2.Error:
                # Skip if column doesn't exist or other error
                continue
    
    return results

def print_header():
    print("\n" + "=" * 100)
    print(f"{bcolors.HEADER}{bcolors.BOLD}DATABASE SANITY CHECK - Integrity Validation{bcolors.ENDC}")
    print("=" * 100 + "\n")

def print_relationship_result(rel, result):
    """Print results for a single relationship"""
    name = rel['name']
    nullable = rel.get('nullable', False)
    
    print(f"{bcolors.BOLD}{name}{bcolors.ENDC}")
    print(f"  Child table: {rel['child_table']} ({result['total_children']} records)")
    print(f"  Foreign keys: {result['non_null_fks']} set, {result['null_fks']} null", end="")
    
    if nullable:
        print(f" {bcolors.OKCYAN}(nulls allowed){bcolors.ENDC}")
    else:
        if result['null_fks'] > 0:
            print(f" {bcolors.WARNING}⚠️  WARNING: Nulls not allowed!{bcolors.ENDC}")
        else:
            print()
    
    if result['orphaned_count'] == 0:
        print(f"  {bcolors.OKGREEN}✓ All foreign keys valid - no orphaned records{bcolors.ENDC}")
    else:
        print(f"  {bcolors.FAIL}✗ ORPHANED RECORDS: {result['orphaned_count']}{bcolors.ENDC}")
        print(f"  {bcolors.FAIL}  First 5 orphaned records:{bcolors.ENDC}")
        for i, (child_id, fk_value) in enumerate(result['orphaned_records'], 1):
            print(f"  {bcolors.FAIL}    {i}. ID={child_id}, {rel['child_column']}={fk_value}{bcolors.ENDC}")
    
    print()

def print_mandatory_column_result(result):
    """Print results for mandatory column check"""
    print(f"{bcolors.FAIL}✗ NULL VALUES in {result['table']}.{result['column']}{bcolors.ENDC}")
    print(f"  {bcolors.FAIL}Column type: {result['data_type']} (NOT NULL){bcolors.ENDC}")
    print(f"  {bcolors.FAIL}Records with NULL: {result['null_count']}{bcolors.ENDC}")
    print(f"  {bcolors.FAIL}Sample IDs: {', '.join(map(str, result['sample_ids']))}{bcolors.ENDC}")
    print()

def main():
    print_header()
    
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Section 1: Check foreign key relationships
        print(f"{bcolors.BOLD}SECTION 1: FOREIGN KEY RELATIONSHIPS{bcolors.ENDC}")
        print("=" * 100 + "\n")
        
        relationship_results = []
        relationship_issues = 0
        
        # Check each relationship
        for rel in RELATIONSHIPS:
            try:
                result = check_relationship(cur, rel)
                relationship_results.append((rel, result))
                
                # Count issues
                if result['orphaned_count'] > 0:
                    relationship_issues += result['orphaned_count']
                if not rel.get('nullable', False) and result['null_fks'] > 0:
                    relationship_issues += result['null_fks']
                    
            except psycopg2.Error as e:
                print(f"{bcolors.FAIL}ERROR checking {rel['name']}: {e}{bcolors.ENDC}\n")
                continue
        
        # Print relationship results
        for rel, result in relationship_results:
            print_relationship_result(rel, result)
        
        # Section 2: Check mandatory columns
        print("=" * 100)
        print(f"{bcolors.BOLD}SECTION 2: MANDATORY COLUMN VALUES{bcolors.ENDC}")
        print("=" * 100 + "\n")
        
        print("Checking for NULL values in NOT NULL columns...")
        mandatory_results = check_mandatory_columns(cur)
        
        if len(mandatory_results) == 0:
            print(f"{bcolors.OKGREEN}✓ All mandatory columns have values - no NULL violations{bcolors.ENDC}\n")
        else:
            print(f"{bcolors.FAIL}Found {len(mandatory_results)} columns with NULL violations:{bcolors.ENDC}\n")
            for result in mandatory_results:
                print_mandatory_column_result(result)
        
        mandatory_issues = sum(r['null_count'] for r in mandatory_results)
        
        # Summary
        print("=" * 100)
        print(f"{bcolors.BOLD}SUMMARY{bcolors.ENDC}")
        print("=" * 100)
        print(f"Relationships checked: {len(relationship_results)}")
        print(f"Mandatory columns checked: {len(mandatory_results) if len(mandatory_results) > 0 else 'All passed'}")
        
        total_issues = relationship_issues + mandatory_issues
        
        if total_issues == 0:
            print(f"{bcolors.OKGREEN}{bcolors.BOLD}✓ ALL CHECKS PASSED - No issues found!{bcolors.ENDC}")
            exit_code = 0
        else:
            print(f"{bcolors.FAIL}{bcolors.BOLD}✗ ISSUES FOUND:{bcolors.ENDC}")
            if relationship_issues > 0:
                print(f"{bcolors.FAIL}  - Foreign key issues: {relationship_issues}{bcolors.ENDC}")
            if mandatory_issues > 0:
                print(f"{bcolors.FAIL}  - Mandatory column violations: {mandatory_issues}{bcolors.ENDC}")
            print(f"{bcolors.WARNING}Please review the issues above and fix data integrity problems.{bcolors.ENDC}")
            exit_code = 1
        
        print("=" * 100 + "\n")
        
        cur.close()
        conn.close()
        
        exit(exit_code)
        
    except psycopg2.Error as e:
        print(f"{bcolors.FAIL}DATABASE ERROR: {e}{bcolors.ENDC}")
        exit(1)
    except Exception as e:
        print(f"{bcolors.FAIL}ERROR: {e}{bcolors.ENDC}")
        import traceback
        traceback.print_exc()
        exit(1)

if __name__ == "__main__":
    main()
