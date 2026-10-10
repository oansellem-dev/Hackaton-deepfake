"""Empreinte faciale locale : YuNet trouve le visage, SFace calcule une empreinte de 128 nombres (OpenCV Zoo, MIT / Apache 2.0).

Usage strictement limité : vérifier que la personne de l'entretien est celle de la pré-vérification (comparaison 1:1,
même entretien), avec le consentement explicite du candidat. L'image est analysée en mémoire puis jetée ; l'empreinte
est renvoyée au serveur, qui la stocke chiffrée et l'efface à la décision du recruteur. Aucune base de visages.
"""
import threading

import cv2
import numpy as np

_lock = threading.Lock()  # chargement des modèles
_infer_lock = threading.Lock()  # le détecteur garde la taille d'entrée en état interne
_detector = None
_recognizer = None


def _load():
    global _detector, _recognizer
    with _lock:
        if _recognizer is None:
            from .models import model_path

            det = model_path("opencv/face_detection_yunet", "face_detection_yunet_2023mar.onnx")
            rec = model_path("opencv/face_recognition_sface", "face_recognition_sface_2021dec.onnx")
            _detector = cv2.FaceDetectorYN.create(det, "", (320, 320), 0.8, 0.3, 5000)
            _recognizer = cv2.FaceRecognizerSF.create(rec, "")
    return _detector, _recognizer


def warm_up() -> None:
    _load()


def embed(bgr: np.ndarray) -> list[float] | None:
    """Empreinte normalisée du plus grand visage de l'image, ou None s'il n'y a pas de visage net."""
    detector, recognizer = _load()
    h, w = bgr.shape[:2]
    with _infer_lock:
        detector.setInputSize((w, h))
        _, faces = detector.detect(bgr)
        if faces is None or len(faces) == 0:
            return None
        face = max(faces, key=lambda f: f[2] * f[3])
        feature = recognizer.feature(recognizer.alignCrop(bgr, face)).flatten()
    norm = float(np.linalg.norm(feature))
    return None if norm == 0 else [round(float(x), 6) for x in feature / norm]


def embed_bytes(image_bytes: bytes) -> list[float] | None:
    bgr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    return None if bgr is None else embed(bgr)
