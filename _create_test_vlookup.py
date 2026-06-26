import openpyxl
from openpyxl import Workbook

# Create a test file to verify VLOOKUP functionality
wb = Workbook()
ws1 = wb.active
ws1.title = "Test"

# Create sheet2 for lookups
ws2 = wb.create_sheet("Lookups")

# Populate Lookups sheet like our Placeholders
ws2['A1'] = 'Project_Department'
ws2['B1'] = 'Tbilisi'
ws2['A2'] = 'Handover_Date'
ws2['B2'] = 45846

# Create a test formula in Test sheet
ws1['A1'] = '=VLOOKUP("Project_Department",Lookups!A:B,2,FALSE)'
ws1['B1'] = 'Should show: Tbilisi'

# Save
wb.save('d:/test-vlookup.xlsx')
print("Test file created: d:/test-vlookup.xlsx")
print("\nNow check if you can open it in Excel and see 'Tbilisi' in cell A1")
print("If VLOOKUP works, this proves the formula structure can work")
