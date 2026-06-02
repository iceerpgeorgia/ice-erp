import pdfplumber, sys

sys.stdout.reconfigure(encoding='utf-8')

pdf = pdfplumber.open('waybill_protocol.pdf')
print(f"Total pages: {len(pdf.pages)}\n")

for i, page in enumerate(pdf.pages):
    text = page.extract_text()
    if text:
        print(f"=== PAGE {i+1} ===")
        print(text)
        print()

pdf.close()
