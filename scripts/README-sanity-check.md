# Database Sanity Check Script

## Overview
The `sanity-check-relationships.py` script validates database integrity by checking:
1. **Foreign key relationships**: Detects orphaned records that reference non-existent parent records
2. **Null constraint violations**: Finds NULL values in foreign key fields that should not be nullable
3. **Mandatory column values**: Validates that all NOT NULL columns have values (no NULLs in mandatory fields)
4. **Data integrity issues**: Identifies broken relationships and missing required data

## Current Relationships Checked

1. **Counteragents → Countries** (country_uuid)
   - Validates all counteragents reference valid countries
   - Nullable: Yes

2. **Counteragents → EntityTypes** (entity_type_uuid)
   - Validates all counteragents reference valid entity types
   - Nullable: Yes

3. **FinancialCodes → FinancialCodes** (parent_uuid, self-referential)
   - Validates parent codes exist in the same table
   - Nullable: Yes (root codes have no parent)

4. **Transactions → FinancialCodes** (financial_code_id)
   - Validates all transactions reference valid financial codes
   - Nullable: No

5. **Transactions → Counteragents** (counteragent_id)
   - Validates transactions reference valid counteragents
   - Nullable: Yes

6. **Projects → Counteragents** (counteragent_id)
   - Validates all projects reference valid counteragents
   - Nullable: No

7. **Projects → FinancialCodes** (financial_code_id)
   - Validates all projects reference valid financial codes
   - Nullable: No

8. **Projects → Users** (employee_id)
   - Validates projects reference valid users (employees)
   - Nullable: Yes

## Usage

Run the script to check all relationships:

```bash
python scripts/sanity-check-relationships.py
```

### Exit Codes
- **0**: All checks passed, no issues found
- **1**: Issues found (orphaned records or constraint violations)

### Output Example

```
====================================================================================================
DATABASE SANITY CHECK - Integrity Validation
====================================================================================================

SECTION 1: FOREIGN KEY RELATIONSHIPS
====================================================================================================

Counteragents → Countries
  Child table: counteragents (3005 records)
  Foreign keys: 3005 set, 0 null (nulls allowed)
  ✓ All foreign keys valid - no orphaned records

Projects → Counteragents
  Child table: projects (935 records)
  Foreign keys: 935 set, 0 null
  ✗ ORPHANED RECORDS: 5
    First 5 orphaned records:
      1. ID=123, counteragent_id=999
      2. ID=124, counteragent_id=998

====================================================================================================
SECTION 2: MANDATORY COLUMN VALUES
====================================================================================================

Checking for NULL values in NOT NULL columns...
Found 2 columns with NULL violations:

✗ NULL VALUES in projects.name
  Column type: character varying (NOT NULL)
  Records with NULL: 3
  Sample IDs: 101, 102, 103

✗ NULL VALUES in counteragents.counteragent_uuid
  Column type: uuid (NOT NULL)
  Records with NULL: 1
  Sample IDs: 2045

====================================================================================================
SUMMARY
====================================================================================================
Relationships checked: 8
Mandatory columns checked: 2
✗ ISSUES FOUND:
  - Foreign key issues: 5
  - Mandatory column violations: 4
Please review the issues above and fix data integrity problems.
====================================================================================================
```

## Adding New Relationships

When you add new foreign key relationships to the database schema, update the `RELATIONSHIPS` list in the script:

### For UUID-based relationships:

```python
{
    'name': 'ChildTable → ParentTable',
    'child_table': 'child_table_name',
    'child_column': 'foreign_key_column',
    'parent_table': 'parent_table_name',
    'parent_column': 'referenced_column',
    'nullable': True  # or False
}
```

### For ID-based relationships (BigInt or String IDs):

```python
{
    'name': 'ChildTable → ParentTable',
    'child_table': 'child_table_name',
    'child_column': 'foreign_key_column',
    'child_id_column': 'id',  # Column to display in reports
    'parent_table': 'parent_table_name',
    'parent_column': 'id',
    'nullable': False,
    'id_based': True  # Important!
}
```

### For self-referential relationships:

```python
{
    'name': 'Table → Table (parent)',
    'child_table': 'table_name',
    'child_column': 'parent_id_column',
    'parent_table': 'table_name',
    'parent_column': 'id_column',
    'nullable': True,
    'self_referential': True  # Important!
}
```

## Example: Adding Employees Table

When you add the Employees table with a relationship to Countries:

```python
{
    'name': 'Employees → Countries',
    'child_table': 'employees',
    'child_column': 'country_uuid',
    'parent_table': 'countries',
    'parent_column': 'country_uuid',
    'nullable': True
}
```

## Best Practices

1. **Run before deployments**: Validate data integrity before pushing to production
2. **Run after imports**: Check relationships after bulk data imports
3. **Run regularly**: Schedule weekly checks to catch issues early
4. **Fix orphaned records**: Don't ignore warnings - clean up data or add missing parent records
5. **Update the script**: Always add new relationships to the RELATIONSHIPS list

## Fixing Issues

### Orphaned Records

If the script finds orphaned records (foreign keys referencing non-existent parents):

1. **Identify the cause**: Did you delete parent records? Import data incorrectly?
2. **Fix the data**: Either:
   - Add missing parent records
   - Update orphaned records to reference valid parents
   - Set foreign keys to NULL (if nullable)
   - Delete invalid records

Example fixes:
```sql
-- Option 1: Set to NULL (if allowed)
UPDATE counteragents SET country_uuid = NULL WHERE country_uuid = 'invalid-uuid';

-- Option 2: Update to valid reference
UPDATE counteragents SET country_uuid = 'valid-uuid' WHERE country_uuid = 'invalid-uuid';

-- Option 3: Delete orphaned records
DELETE FROM counteragents WHERE country_uuid = 'invalid-uuid';
```

### Mandatory Column Violations

If the script finds NULL values in NOT NULL columns:

1. **Identify affected records**: Check the sample IDs shown in the output
2. **Fix the data**: Either:
   - Provide missing values
   - Delete invalid records
   - Update column definition to allow NULLs (if appropriate)

Example fixes:
```sql
-- Option 1: Provide default values
UPDATE projects SET name = 'Unnamed Project' WHERE name IS NULL;

-- Option 2: Provide specific values based on business logic
UPDATE counteragents 
SET counteragent_uuid = gen_random_uuid() 
WHERE counteragent_uuid IS NULL;

-- Option 3: Delete invalid records
DELETE FROM projects WHERE name IS NULL;
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
- name: Database Sanity Check
  run: python scripts/sanity-check-relationships.py
```

The script will fail the build if issues are found (exit code 1).

## Troubleshooting

### "Table does not exist" error
- Make sure all tables in the RELATIONSHIPS list exist in your database
- Run migrations if needed: `pnpm prisma migrate deploy`

### "Column does not exist" error
- Verify column names match your schema
- Check for typos in the RELATIONSHIPS list

### "Operator does not exist" error
- Ensure `id_based: True` is set for BigInt/String ID relationships
- The script uses type casting for these relationships

## Maintenance

**TODO List:**
- [ ] Add Employees relationships when table is created
- [ ] Add MI_Producers relationships when table is created
- [ ] Add MI_Groups relationships when table is created
- [ ] Add MI_Models relationships when table is created
- [ ] Update when any new foreign keys are added to existing tables
