import fitz

doc = fitz.open('waybill_protocol.pdf')
with open('_pdf_text.txt', 'w', encoding='utf-8') as out:
    for i, page in enumerate(doc):
        text = page.get_text()
        if text.strip():
            out.write(f"=== PAGE {i+1} ===\n")
            out.write(text)
            out.write("\n")
print("Done")
