import openpyxl

excel_file = "templates/GE78BG0000000893486000GEL.xlsx"
sheet_name = 'GE78BG0000000893486000GEL'

print(f"📄 Opening Excel file: {excel_file}\n")
wb = openpyxl.load_workbook(excel_file, read_only=True)
ws = wb[sheet_name]

# Get headers from first row
headers = []
for col_idx, cell in enumerate(ws[1], 1):
    if cell.value:
        headers.append((col_idx, cell.value))

print(f"📋 All column headers in the Excel file:\n")
for idx, header in headers:
    print(f"   Column {idx}: {header}")

print(f"\n🔍 Looking for required columns:")
required = [
    'Ref',
    'ოპერაციის იდ',
    'გამგზავნის ანგარიშის ნომერი',
    'ბენეფიციარის ანგარიშის ნომერი',
    'დებეტი'
]

header_names = [h[1] for h in headers]
for req in required:
    if req in header_names:
        print(f"   ✅ Found: {req}")
    else:
        print(f"   ❌ Missing: {req}")

wb.close()
