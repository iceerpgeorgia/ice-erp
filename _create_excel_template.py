import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

# Create workbook
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Payments Import"

# Header row
headers = [
    'account_uuid',
    'counteragent_uuid', 
    'project_uuid',
    'financial_code_uuid',
    'currency_code',
    'amount',
    'transaction_date',
    'correction_date',
    'income_tax',
    'comment',
    'purpose',
    'operation_id_1',
    'operation_id_2',
    'order_id',
    'record_id',
    'usd_gel_rate',
    'eur_gel_rate'
]

# Write headers
for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

# Sample data row
sample_data = [
    'GE65TB7856036050100002',
    'B4968862-3843-414D-9E73-1A7611618B41',
    'CFFC1C06-B78B-45A0-8A02-37A23706EAFC',
    'B59170EC-16CC-499A-9FF7-0428DCB8F727',
    'USD',
    33918.59,
    '05.11.2019',
    '',
    'false',
    'ავანსი ლიფტების შესასყიდად',
    'Payment for lift procurement',
    '2594',
    '698fe5_ac_8a076d',
    '',
    'fa7ff134-f253-4538-9f84-7a6586b9b975',
    2.9582,
    3.3093
]

# Write sample row
for col, value in enumerate(sample_data, 1):
    ws.cell(row=2, column=col, value=value)

# Add empty rows for user to fill (rows 3-22)
for row in range(3, 23):
    for col in range(1, len(headers) + 1):
        ws.cell(row=row, column=col, value='')

# Set column widths
widths = [25, 35, 35, 35, 12, 15, 15, 15, 12, 30, 25, 15, 20, 15, 35, 12, 12]
for idx, width in enumerate(widths, 1):
    ws.column_dimensions[openpyxl.utils.get_column_letter(idx)].width = width

# Freeze header row
ws.freeze_panes = 'A2'

# Add instructions sheet
ws_info = wb.create_sheet('Instructions')
ws_info['A1'] = 'Payment Import Instructions'
ws_info['A1'].font = Font(bold=True, size=14)
ws_info['A3'] = 'Column Definitions:'
ws_info['A3'].font = Font(bold=True, size=11)

instructions = [
    ('', ''),
    ('REQUIRED COLUMNS:', ''),
    ('account_uuid', 'UUID of bank account (GE65TB7856036050100002)'),
    ('counteragent_uuid', 'UUID of counteragent company/person'),
    ('project_uuid', 'UUID of project'),
    ('financial_code_uuid', 'UUID of financial code'),
    ('currency_code', 'Currency: GEL, USD, EUR, etc.'),
    ('amount', 'Numeric amount (use decimal point: 1000.50)'),
    ('transaction_date', 'Date in DD.MM.YYYY format (05.11.2019)'),
    ('', ''),
    ('OPTIONAL COLUMNS:', ''),
    ('correction_date', 'Correction date (must differ from transaction_date)'),
    ('income_tax', 'true/false - Income tax applied'),
    ('comment', 'Payment description'),
    ('purpose', 'Business purpose'),
    ('operation_id_1', 'Custom reference ID 1'),
    ('operation_id_2', 'Custom reference ID 2'),
    ('order_id', 'Order reference'),
    ('record_id', 'Original system record ID'),
    ('usd_gel_rate', 'USD to GEL exchange rate'),
    ('eur_gel_rate', 'EUR to GEL exchange rate'),
]

for idx, (col_name, description) in enumerate(instructions, 5):
    ws_info.cell(row=idx, column=1, value=col_name)
    ws_info.cell(row=idx, column=2, value=description)
    if col_name and col_name.endswith(':'):
        ws_info.cell(row=idx, column=1).font = Font(bold=True, size=11)

ws_info.column_dimensions['A'].width = 25
ws_info.column_dimensions['B'].width = 65

# Save workbook
wb.save('PAYMENT_IMPORT_TEMPLATE.xlsx')
print('✓ Excel template created: PAYMENT_IMPORT_TEMPLATE.xlsx')
