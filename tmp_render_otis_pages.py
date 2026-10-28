import os
import fitz

PDF_PATH = r"C:\Users\User\Downloads\Bagrationi Avenue Jobs.pdf"
OUT_DIR = r"d:\next-postgres-starter\tmp_otis_pages"

os.makedirs(OUT_DIR, exist_ok=True)

doc = fitz.open(PDF_PATH)
print(f"pages: {len(doc)}")

for i, page in enumerate(doc):
    mat = fitz.Matrix(3.0, 3.0)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    out_path = os.path.join(OUT_DIR, f"page_{i+1}.png")
    pix.save(out_path)
    print(out_path)
