from fastapi.testclient import TestClient

from app.cv.compare import analyze
from app.main import app

client = TestClient(app)


def make_pdf(lines: list[str]) -> bytes:
    """Petit PDF texte (une page, Helvetica), suffisant pour tester l'extraction."""
    esc = lambda s: s.replace(chr(92), chr(92) * 2).replace("(", chr(92) + "(").replace(")", chr(92) + ")")
    content = "BT /F1 11 Tf 50 800 Td 14 TL " + " ".join(f"({esc(l)}) Tj T*" for l in lines) + " ET"
    stream = content.encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


CV = [
    "Ada LOVELACE", "ada.lovelace@example.org | +33 6 12 34 56 78", "github.com/adalovelace",
    "Formation", "Eugenia School - Bachelor AI 2025", "Experience", "Analytical Engines - Developpeuse 2024",
]


def test_consistent_cv():
    declared = {"firstName": "Ada", "lastName": "Lovelace", "email": "ada.lovelace@example.org",
                "phone": "06 12 34 56 78", "company": "Analytical Engines", "githubUrl": "https://github.com/adalovelace"}
    r = analyze("\n".join(CV), declared)
    assert r["inconsistencies"] == []
    assert set(r["consistent"]) == {"nom", "e-mail", "téléphone", "GitHub", "entreprise"}
    assert "Eugenia School" in r["found"]["schools"]
    # Sans accent (PDF mal encodé, clavier anglais) : l'école est quand même repérée.
    assert analyze("Universite Paris-Saclay - Master 2020", {})["found"]["schools"] == ["Universite Paris-Saclay"]
    assert any("google.com/search" in l["url"] for l in r["links"])


def test_inconsistencies_and_absence_never_penalizes():
    declared = {"firstName": "Bob", "lastName": "Martin", "email": "bob@other.com", "phone": "+44 7700 900123",
                "company": "Initech"}
    fields = {i["field"] for i in analyze("\n".join(CV), declared)["inconsistencies"]}
    assert fields == {"cv.name", "cv.email", "cv.phone", "cv.company"}
    # Rien de déclaré à part le nom : seul le nom est comparé.
    assert analyze("\n".join(CV), {"firstName": "Ada", "lastName": "Lovelace"})["inconsistencies"] == []


def test_endpoint_reads_the_pdf():
    r = client.post("/cv/analyze", files={"file": ("cv.pdf", make_pdf(CV), "application/pdf")},
                    data={"declared": '{"firstName": "Ada", "lastName": "Lovelace", "email": "x@y.fr"}'})
    assert r.status_code == 200, r.text
    assert [i["field"] for i in r.json()["inconsistencies"]] == ["cv.email"]
    assert client.post("/cv/analyze", files={"file": ("cv.pdf", b"pas un pdf", "application/pdf")}).status_code == 422
