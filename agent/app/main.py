import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, UploadFile

from . import face_identity, passive_detector
from .recommend import assess
from .schemas import AssessmentInput, AssessmentOutput, PassiveSummary

log = logging.getLogger(__name__)


def _warm_up() -> None:
    try:
        passive_detector.warm_up()
        face_identity.warm_up()
        log.warning("Modèles chargés.")
    except Exception as e:  # le score reste disponible même sans les modèles d'image
        log.warning("Chargement des modèles impossible : %s", e)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Préchargement en arrière-plan : la première capture ne fait pas attendre l'entretien.
    threading.Thread(target=_warm_up, daemon=True).start()
    yield


app = FastAPI(title="Agent de score et recommandation", description="Score consultatif : le recruteur décide.",
              lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/assess", response_model=AssessmentOutput)
def post_assess(inp: AssessmentInput) -> AssessmentOutput:
    """Appelé par le panneau recruteur après chaque défi ; renvoie score, explication et prochains défis."""
    if inp.passive is None:
        inp.passive = passive_detector.summary(inp.session_id)
    return assess(inp)


# Fonction synchrone : FastAPI l'exécute dans un fil à part, l'analyse d'image ne bloque jamais le calcul du score.
@app.post("/frame/{session_id}")
def post_frame(session_id: str, image: UploadFile = File(...)) -> dict:
    """Une capture du visage (JPEG/PNG) envoyée par le panneau toutes les ~2 s. L'image est analysée
    en mémoire puis jetée ; seule la probabilité est gardée."""
    data = image.file.read()
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
