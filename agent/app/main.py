import json

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from .cv import compare as cv_compare
from .cv.extract_pdf import extract_text_from_pdf
from .recommend import assess
from .schemas import AssessmentInput, AssessmentOutput

# L'agent ne reçoit jamais d'image du visage : l'empreinte et le détecteur passif tournent dans le navigateur,
# il ne voit que des nombres (signaux, probabilités, résultats de défis) et, pour le CV, le PDF chargé par le recruteur.
app = FastAPI(title="Agent de score et recommandation", description="Score consultatif : le recruteur décide.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/assess", response_model=AssessmentOutput)
def post_assess(inp: AssessmentInput) -> AssessmentOutput:
    """Appelé par le serveur à chaque mise à jour ; renvoie score, explication et prochains défis."""
    return assess(inp)


@app.post("/cv/analyze")
def cv_analyze(file: UploadFile = File(...), declared: str = Form("{}"), country: str = Form("FR")) -> dict:
    """CV chargé par le recruteur : lu en mémoire, comparé aux déclarations du candidat, puis oublié."""
    try:
        text = extract_text_from_pdf(file.file.read())
    except Exception:  # PDF malformé, chiffré ou tronqué : on le dit au recruteur plutôt que d'échouer
        raise HTTPException(status_code=422, detail="PDF illisible")
    if not text.strip():
        raise HTTPException(status_code=422, detail="PDF sans texte (CV scanné ?) : comparaison impossible")
    return cv_compare.analyze(text, json.loads(declared or "{}"), country)
