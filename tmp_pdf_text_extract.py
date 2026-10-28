import fitz

PDF_PATH = r"C:\Users\User\Downloads\Bagrationi Avenue Jobs.pdf"


def main():
    doc = fitz.open(PDF_PATH)
    print(f"pages: {len(doc)}")

    for i, page in enumerate(doc):
        text = page.get_text("text")
        print(f"\n===== PAGE {i+1} TEXT LEN: {len(text)} =====")
        print(text[:3000])


if __name__ == "__main__":
    main()
