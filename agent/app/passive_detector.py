"""Détecteur passif de face-swap, exécuté localement (aucune image n'est envoyée à un tiers).

Modèle : DeepfakeGuard V2 (Samson5827/deepfakeguard-v2, export ONNX), entraîné sur Celeb-DF v2.
Licence « recherche / non commercial » : acceptable pour le hackathon, à remplacer avant un produit commercial.
Précision annoncée par l'auteur : ~80 % sur son jeu de test, ~1 fausse image sur 5 passe pour vraie.
C'est donc un signal MOYEN, jamais fort, qui se combine aux défis.

Règles du projet : on ne cherche pas qui est la personne, aucune image n'est conservée (seulement la
probabilité par image), et une image sans visage est « non concluante » : elle ne pénalise jamais.
"""
import json
import threading
from collections import defaultdict, deque
from statistics import median

import cv2
import numpy as np
from pydantic import BaseModel

from .schemas import PassiveSummary

REPO = "Samson5827/deepfakeguard-v2"
INPUT_SIZE = 224
FACE_MARGIN = 0.18
MIN_FRAMES = 5  # en dessous, pas assez d'images pour conclure
WINDOW = 15  # médiane glissante : un instantané raté ne suffit pas à lever un signal

_lock = threading.Lock()  # chargement des modèles
_infer_lock = threading.Lock()  # analyse : le détecteur de visage OpenCV n'est pas prévu pour plusieurs fils à la fois
_session = None
_cascade = None
_scores: dict[str, deque] = defaultdict(lambda: deque(maxlen=WINDOW))  # session_id -> p_fake


class FrameResult(BaseModel):
    face_found: bool
    fake_probability: float | None = None  # 0..1, None si pas de visage


def _load():
    global _session, _cascade
    with _lock:
        if _session is None:
            import onnxruntime as ort

            from .models import model_path

            path = model_path(REPO, "deepfakeguard_v2.onnx")
            labels = json.load(open(model_path(REPO, "labels_v2.json")))
            # p_real = sortie sigmoïde de la classe « positive » ; on vérifie plutôt que d'en supposer l'ordre.
            if labels.get("positive_class_name") != "real":
                raise RuntimeError("Convention de sortie inattendue pour le modèle.")
            _session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
            _cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    return _session, _cascade


def _crop_face(bgr: np.ndarray, cascade) -> np.ndarray | None:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    if len(faces) == 0:
        return None
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])  # le plus grand visage
    mx, my = int(w * FACE_MARGIN), int(h * FACE_MARGIN)
    H, W = bgr.shape[:2]
    return bgr[max(0, y - my):min(H, y + h + my), max(0, x - mx):min(W, x + w + mx)]


def analyze_frame(image_bytes: bytes) -> FrameResult:
    """Décode une image (JPEG/PNG), détecte le visage, renvoie la probabilité de fake. Rien n'est stocké."""
    bgr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Image illisible")
    session, cascade = _load()
    with _infer_lock:
        face = _crop_face(bgr, cascade)
        if face is None or face.size == 0:
            return FrameResult(face_found=False)
        rgb = cv2.cvtColor(cv2.resize(face, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
        # Valeurs brutes 0..255 en float32, comme à l'entraînement (pas de division par 255).
        p_real = float(session.run(None, {session.get_inputs()[0].name: rgb.astype(np.float32)[None]})[0][0][0])
    return FrameResult(face_found=True, fake_probability=round(1 - p_real, 4))


def warm_up() -> None:
    _load()


def record(session_id: str, result: FrameResult) -> PassiveSummary:
    if result.fake_probability is not None:
        _scores[session_id].append(result.fake_probability)
    return summary(session_id)


def summary(session_id: str) -> PassiveSummary:
    s = list(_scores.get(session_id, []))
    return PassiveSummary(frames_analyzed=len(s), median_fake_probability=round(median(s), 3) if s else None)


def forget(session_id: str) -> None:
    _scores.pop(session_id, None)
