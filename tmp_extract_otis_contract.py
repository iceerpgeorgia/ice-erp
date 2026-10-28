import json
import fitz  # PyMuPDF
from PIL import Image
import numpy as np
import easyocr

PDF_PATH = r"C:\Users\User\Downloads\Bagrationi Avenue Jobs.pdf"
OUT_JSON = r"d:\next-postgres-starter\tmp_otis_contract_ocr.json"
OUT_TXT = r"d:\next-postgres-starter\tmp_otis_contract_ocr.txt"


def pix_to_pil(pix):
    mode = "RGB" if pix.n < 4 else "RGBA"
    return Image.frombytes(mode, [pix.width, pix.height], pix.samples)


def main():
    doc = fitz.open(PDF_PATH)
    reader = easyocr.Reader(["en"], gpu=False)

    all_pages = []
    text_lines_out = []

    for i, page in enumerate(doc):
        # Render each page with decent zoom for OCR
        mat = fitz.Matrix(2.2, 2.2)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        image = pix_to_pil(pix)

        # Rotate candidates to handle scanned orientation
        rotations = [0, 90, 180, 270]
        best = {"rotation": 0, "words": [], "char_count": -1}

        for rot in rotations:
            img = image.rotate(rot, expand=True)
            arr = np.array(img)
            result = reader.readtext(arr, detail=1, paragraph=False)
            text_joined = " ".join([r[1] for r in result])
            score = len(text_joined)
            if score > best["char_count"]:
                best = {
                    "rotation": rot,
                    "words": result,
                    "char_count": score,
                }

        page_obj = {
            "page": i + 1,
            "rotation": best["rotation"],
            "char_count": best["char_count"],
            "words": [
                {
                    "bbox": w[0],
                    "text": w[1],
                    "conf": float(w[2]),
                }
                for w in best["words"]
            ],
        }
        all_pages.append(page_obj)

        text_lines_out.append(f"===== PAGE {i+1} (rot={best['rotation']}, chars={best['char_count']}) =====")
        # print text in reading order approximation by y then x
        words_sorted = sorted(page_obj["words"], key=lambda w: (min(p[1] for p in w["bbox"]), min(p[0] for p in w["bbox"])))
        text_lines_out.extend([w["text"] for w in words_sorted])
        text_lines_out.append("")

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_pages, f, ensure_ascii=False, indent=2)

    with open(OUT_TXT, "w", encoding="utf-8") as f:
        f.write("\n".join(text_lines_out))

    print(f"Saved OCR JSON: {OUT_JSON}")
    print(f"Saved OCR text: {OUT_TXT}")


if __name__ == "__main__":
    main()
