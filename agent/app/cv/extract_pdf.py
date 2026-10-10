import io
from typing import Union, BinaryIO
import pdfplumber
import sys

def extract_text_from_pdf(pdf_source: Union[str, BinaryIO, bytes]) -> str:
    """
    Extrait tout le texte d'un fichier PDF avec pdfplumber.
    Accepte un chemin de fichier (str), un flux binaire (file-like object), ou des octets bruts (bytes).
    """
    if isinstance(pdf_source, bytes):
        pdf_source = io.BytesIO(pdf_source)

    extracted_pages = []
    with pdfplumber.open(pdf_source) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                extracted_pages.append(text.strip())

    return "\n\n".join(extracted_pages)

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\hecto\OneDrive\Bureau\CV_Hector_Lebrun.pdf"
    print(f"Extraction du fichier : {path}\n" + "="*50)
    print(extract_text_from_pdf(path))

