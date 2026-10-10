from fastapi import FastAPI, File, HTTPException, UploadFile

from . import face_identity, passive_detector
from .recommend import assess
from .schemas import AssessmentInput, AssessmentOutput, PassiveSummary

app = FastAPI(title="Agent de score et recommandation", description="Score consultatif : le recruteur décide.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/assess", response_model=AssessmentOutput)
def post_assess(inp: AssessmentInput) -> AssessmentOutput:
    """Appelé par le panneau recruteur après chaque défi ; renvoie score, explication et prochains défis."""
    if inp.passive is None:
        inp.passive = passive_detector.summary(inp.session_id)
    return assess(inp)


@app.post("/frame/{session_id}")
async def post_frame(session_id: str, image: UploadFile = File(...)) -> dict:
    """Une capture du visage (JPEG/PNG) envoyée par le panneau toutes les ~2 s. L'image est analysée
    en mémoire puis jetée ; seule la probabilité est gardée."""
    data = await image.read()
    try:
        result = passive_detector.analyze_frame(data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    # Empreinte faciale pour la comparaison 1:1 avec la pré-vérification ; renvoyée au serveur, jamais conservée ici.
    return {"frame": result, "summary": passive_detector.record(session_id, result),
            "embedding": face_identity.embed_bytes(data)}


@app.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    passive_detector.forget(session_id)
    return {"deleted": session_id}
