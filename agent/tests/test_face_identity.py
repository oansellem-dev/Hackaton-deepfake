from pathlib import Path

import cv2
import numpy as np

from app import face_identity

FACE = cv2.imread(str(Path(__file__).parent / "data" / "astronaut_face.jpg"))  # domaine public (NASA)


def cos(a, b):
    return float(np.dot(a, b))


def test_same_face_survives_resize_light_and_compression():
    ref = face_identity.embed(FACE)
    assert ref is not None and len(ref) == 128
    small = cv2.resize(FACE, None, fx=0.6, fy=0.6)
    darker = cv2.convertScaleAbs(FACE, alpha=0.75, beta=-10)
    jpeg = cv2.imdecode(cv2.imencode(".jpg", FACE, [cv2.IMWRITE_JPEG_QUALITY, 40])[1], cv2.IMREAD_COLOR)
    for variant in (small, darker, jpeg):
        emb = face_identity.embed(variant)
        assert emb is not None and cos(ref, emb) > 0.6


def test_no_face_gives_no_embedding():
    assert face_identity.embed(np.full((240, 320, 3), 127, np.uint8)) is None
