import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import passive_detector as pd
from app.main import app
from app.schemas import AssessmentInput, ChallengeResult, PassiveSummary
from app.recommend import assess

client = TestClient(app)


def jpeg(img):
    return cv2.imencode(".jpg", img)[1].tobytes()


def test_frame_without_face_is_inconclusive_and_never_penalizes():
    blank = np.full((300, 300, 3), 128, np.uint8)
    r = client.post("/frame/s-blank", files={"image": ("f.jpg", jpeg(blank), "image/jpeg")})
    assert r.status_code == 200
    assert r.json()["frame"] == {"face_found": False, "fake_probability": None}
    assert r.json()["summary"]["frames_analyzed"] == 0


def test_garbage_upload_is_422():
    r = client.post("/frame/s-bad", files={"image": ("f.jpg", b"not an image", "image/jpeg")})
    assert r.status_code == 422


def base(passive):
    return AssessmentInput(session_id="s", passive=passive,
                           challenges=[ChallengeResult(type="hand_occlusion", status="passed", compliance=1.0)])


def test_passive_needs_enough_frames_and_threshold():
    few = assess(base(PassiveSummary(frames_analyzed=2, median_fake_probability=0.99)))
    low = assess(base(PassiveSummary(frames_analyzed=10, median_fake_probability=0.3)))
    high = assess(base(PassiveSummary(frames_analyzed=10, median_fake_probability=0.95)))
    assert few.score == low.score == 100
    assert high.score < 100 and any(s.id == "passive_detector" for s in high.signals)
    assert 100 - high.score <= 15  # signal moyen, plafonné


def test_assess_pulls_stored_summary_for_the_session():
    pd._scores["s-store"].extend([0.9] * 6)
    out = client.post("/assess", json={"session_id": "s-store",
                                       "challenges": [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0}]}).json()
    assert any(s["id"] == "passive_detector" for s in out["signals"])
    client.delete("/session/s-store")
    assert pd.summary("s-store").frames_analyzed == 0
