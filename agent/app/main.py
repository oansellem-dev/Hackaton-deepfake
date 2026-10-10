from fastapi import FastAPI, File, HTTPException, UploadFile

from . import passive_detector
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
    try:
        result = passive_detector.analyze_frame(await image.read())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"frame": result, "summary": passive_detector.record(session_id, result)}


@app.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict:
    passive_detector.forget(session_id)
    return {"deleted": session_id}
