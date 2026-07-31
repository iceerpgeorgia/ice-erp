import openpyxl
from openpyxl.utils import get_column_letter

# Test: Can we manually evaluate formulas in the exported file?
wb = openpyxl.load_workbook('d:/final-test.xlsx', data_only=False)

# Check both sheets
print("SHEET ANALYSIS")
print("=" * 70)
print(f"Sheet names: {wb.sheetnames}")
print(f"Active sheet: {wb.active.title}")

# Get both sheets
handover = wb['Handover']
placeholders = wb['Placeholders']

print(f"\nHandover sheet: {handover.dimensions}")
print(f"Placeholders sheet: {placeholders.dimensions}")

# Check if formulas in C4 can reference Placeholders properly
c4_cell = handover['C4']
print(f"\n\nC4 Formula: {c4_cell.value[:100]}")

# Now check the Placeholders data
print("\n\nPlaceholders data structure:")
print(f"First 5 rows:")
for row_idx in range(1, 6):
    a_cell = placeholders[f'A{row_idx}']
    b_cell = placeholders[f'B{row_idx}']
    print(f"  Row {row_idx}: A={a_cell.value}, B={b_cell.value}")

# The formula in C4 looks for "Project_Department" in Placeholders column A
# and should return the value from column B

# Check if the lookup value exists
print("\n\nLooking for 'Project_Department' in Placeholders sheet:")
found = False
for row_idx in range(1, 20):
    a_cell = placeholders[f'A{row_idx}']
    if a_cell.value == 'Project_Department':
        b_cell = placeholders[f'B{row_idx}']
        print(f"  Found at row {row_idx}: B{row_idx} = {b_cell.value}")
        found = True
        break

if not found:
    print("  NOT FOUND!")

# Try to understand why the formula isn't showing a result
# Check if there's a calculation mode issue
print("\n\nChecking if workbook has calc settings...")
if hasattr(wb, 'properties'):
    print(f"  Workbook properties: {wb.properties}")
