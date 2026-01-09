# Parsing Rule Formula Syntax

## Overview
Parsing rule conditions use Excel-style formulas to define matching criteria for bank transaction records. When a transaction matches the formula condition, it gets assigned the specified Payment ID.

## Supported Functions

### Logical Functions
- **OR(condition1, condition2, ...)** - Returns true if any condition is true
- **AND(condition1, condition2, ...)** - Returns true if all conditions are true  
- **NOT(condition)** - Inverts the boolean result

### Text Search Functions
- **SEARCH("text", column)** - Case-insensitive search, returns true if text is found anywhere in column
- **EXACT("text", column)** - Case-sensitive exact match

### Text Functions
- **LEN(column)** - Returns length of text
- **LEFT(column, n)** - Returns first n characters
- **RIGHT(column, n)** - Returns last n characters
- **UPPER(column)** - Converts to uppercase
- **LOWER(column)** - Converts to lowercase

### Null Checks
- **ISBLANK(column)** - Returns true if column is NULL
- **ISEMPTY(column)** - Returns true if column is NULL or empty string

### Comparison Operators
Standard operators: `=`, `<>`, `>`, `<`, `>=`, `<=`

## Examples

### Simple Text Search
```excel
SEARCH("გიორგი", docsendername)
```
Matches if "გიორგი" appears anywhere in the sender name.

### Multiple Search Terms (OR)
```excel
OR(SEARCH("salary", docinformation), SEARCH("ხელფასი", docinformation))
```
Matches if either "salary" or "ხელფასი" is found in the information field.

### Amount and Currency Check
```excel
AND(docsrcamt > 1000, docsrcccy = "GEL")
```
Matches if source amount is greater than 1000 AND currency is GEL.

### Complex Nested Conditions
```excel
AND(
  OR(SEARCH("გიორგი", docsendername), SEARCH("ნიქაბაძე", docsendername)),
  docsrcamt > 500,
  NOT(ISBLANK(docno))
)
```
Matches if:
- Sender name contains "გიორგი" OR "ნიქაბაძე"
- AND source amount is greater than 500
- AND document number is not blank

### Exact Document Number
```excel
EXACT("CONTRACT-001-2024", docno)
```
Matches only if document number exactly equals "CONTRACT-001-2024" (case-sensitive).

### Date Check (using text comparison)
```excel
docvaluedate >= "2024-01-01"
```
Matches if value date is on or after January 1, 2024.

### Branch Filter
```excel
AND(docbranch = "TBILISI", docdepartment = "001")
```
Matches transactions from Tbilisi branch, department 001.

### Not Empty Check
```excel
NOT(ISEMPTY(docsendername))
```
Matches if sender name is not null and not empty.

## SQL Translation

The formula parser automatically translates Excel functions to SQL:

| Excel Formula | SQL Translation |
|---------------|----------------|
| `SEARCH("text", col)` | `col ILIKE '%text%'` |
| `EXACT("text", col)` | `col = 'text'` |
| `ISBLANK(col)` | `col IS NULL` |
| `ISEMPTY(col)` | `(col IS NULL OR col = '')` |
| `LEN(col)` | `LENGTH(col)` |
| `OR(a, b)` | `a OR b` |
| `AND(a, b)` | `a AND b` |
| `NOT(a)` | `NOT a` |

## Validation

The formula validator checks:
- Balanced parentheses
- Balanced quotes (single and double)
- Valid function names
- Valid column names (against available columns from raw data table)
- SQL preview generation

## Tips

1. **Use double quotes** for string literals: `SEARCH("text", column)`
2. **Column names** should match exactly (case-insensitive): `docsendername`, `docno`, `docsrcamt`
3. **Nest conditions** using OR/AND/NOT for complex logic
4. **View SQL preview** in the validation feedback to verify translation
5. **Test formulas** - the validator shows if your formula is syntactically correct before saving

## Available Columns (BOG Example)

Common columns in BOG raw data tables:
- `docsendername` - Sender/payer name
- `docinformation` - Transaction description
- `docsrcamt` - Source amount
- `docsrcccy` - Source currency
- `docdstamt` - Destination amount  
- `docdstccy` - Destination currency
- `docno` - Document number
- `docvaluedate` - Value date
- `docrecdate` - Recording date
- `docbranch` - Branch code
- `docdepartment` - Department code
- `dockey` - Unique document key

Column names vary by bank and parsing scheme. The UI will show available columns when you select a scheme.
