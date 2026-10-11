from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def post(body):
    r = client.post("/assess", json={"session_id": "s1", **body})
    assert r.status_code == 200, r.text
    return r.json()


def test_no_data_is_insufficient_not_green():
    out = post({})
    assert out["level"] == "insufficient_data" and out["score"] is None
    assert out["recommendations"]


def test_absence_of_trace_never_lowers_score():
    base = post({"challenges": [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0}]})
    with_missing = post({"challenges": [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0},
                                        {"type": "head_turn", "status": "inconclusive"},
                                        {"type": "sunglasses", "status": "not_performed"}],
                         "environment": {"virtual_camera_detected": None, "declared_country": "FR"}})
    assert base["score"] == with_missing["score"] == 100 and base["level"] == "green"


def test_real_candidate_is_green():
    out = post({"environment": {"virtual_camera_detected": False, "ip_country": "FR", "declared_country": "FR"},
                "challenges": [{"type": "hand_occlusion", "status": "passed", "compliance": 0.95, "fidelity_loss": 0.05}]})
    assert out["level"] == "green"


def test_deepfake_scenario_is_red():
    out = post({"environment": {"virtual_camera_detected": True, "camera_labels": ["OBS Virtual Camera"]},
                "challenges": [{"type": "hand_occlusion", "status": "failed", "compliance": 0.2, "fidelity_loss": 0.8}]})
    assert out["level"] == "red" and out["score"] < 45
    assert all("faux candidat" not in s["message"].lower() for s in out["signals"])


def test_vpn_softens_location_mismatch():
    env = {"ip_country": "NL", "declared_country": "FR"}
    plain = post({"environment": env, "challenges": [{"type": "head_turn", "status": "passed"}]})
    vpn = post({"environment": {**env, "vpn_suspected": True}, "challenges": [{"type": "head_turn", "status": "passed"}]})
    assert vpn["score"] > plain["score"]


def test_recommendations_skip_done_challenges_and_excluded_types():
    out = post({"challenges": [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0}]})
    types = [r["challenge"] for r in out["recommendations"]]
    assert "hand_occlusion" not in types and "alter_expression" not in types


def test_virtual_camera_alone_is_orange_not_green():
    out = post({"environment": {"virtual_camera_detected": True}})
    assert out["level"] == "orange" and out["score"] == 75


def test_timezone_flag_and_available_challenges():
    out = post({"environment": {"timezone_consistent": False},
                "challenges": [{"type": "head_turn", "status": "passed"}],
                "available_challenges": ["hand_occlusion", "head_turn", "random_phrase"]})
    assert any(s["id"] == "location_mismatch" for s in out["signals"])
    assert {r["challenge"] for r in out["recommendations"]} <= {"hand_occlusion", "random_phrase"}


def test_face_continuity_only_penalizes_a_measured_difference():
    chal = [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0}]
    unknown = post({"challenges": chal, "face_continuity": None})
    same = post({"challenges": chal, "face_continuity": True})
    diff = post({"challenges": chal, "face_continuity": False})
    assert unknown["score"] == same["score"] == 100
    assert diff["score"] == 70 and diff["level"] == "orange" and any(s["id"] == "face_continuity" for s in diff["signals"])


def test_screen_flash_only_penalizes_a_finished_test_without_reaction():
    chal = [{"type": "hand_occlusion", "status": "passed", "compliance": 1.0}]
    unknown = post({"challenges": chal, "screen_flash_responsive": None})
    reacted = post({"challenges": chal, "screen_flash_responsive": True})
    no_reaction = post({"challenges": chal, "screen_flash_responsive": False})
    assert unknown["score"] == reacted["score"] == 100
    assert no_reaction["score"] == 85 and any(s["id"] == "screen_flash" for s in no_reaction["signals"])
    assert all("faux candidat" not in s["message"].lower() for s in no_reaction["signals"])


def test_precheck_challenges_count_for_score_but_stay_recommended_live():
    out = post({"challenges": [{"type": "hand_occlusion", "status": "failed", "phase": "precheck"}],
                "available_challenges": ["hand_occlusion", "head_turn", "random_phrase"]})
    assert out["score"] < 100
    assert out["recommendations"][0]["challenge"] == "hand_occlusion"


def test_passive_summary_is_echoed_for_the_report():
    out = post({"passive": {"frames_analyzed": 6, "median_fake_probability": 0.2},
                "challenges": [{"type": "head_turn", "status": "passed"}]})
    assert out["passive"] == {"frames_analyzed": 6, "median_fake_probability": 0.2}


def test_agent_never_accepts_face_images():
    # Les images du visage ne quittent jamais le navigateur : l'agent n'a aucune route pour en recevoir.
    from app.main import app as agent_app
    assert not any("frame" in getattr(r, "path", "") for r in agent_app.routes)
    r = client.post("/frame/s1", files={"image": ("f.jpg", b"\xff\xd8\xff", "image/jpeg")})
    assert r.status_code == 404
