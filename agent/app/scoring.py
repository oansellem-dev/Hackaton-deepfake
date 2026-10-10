"""Score de fiabilité : règles pondérées, point de départ à ajuster sur les 20 tests."""
from .schemas import (
    AssessmentInput, ChallengeResult, ChallengeStatus, ChallengeType, Level, Severity, Signal,
)

# Dégradation moyenne mesurée par GOTCHA (Mittal et al. 2024, %), par défi : plus c'est haut,
# plus le défi révèle un deepfake. Sert à pondérer la gravité d'un échec et à ordonner les recommandations.
GOTCHA_DEGRADATION = {
    ChallengeType.HAND_OCCLUSION: 0.914,
    ChallengeType.FINGER_PRESS: 0.827,
    ChallengeType.FACEMASK: 0.826,
    ChallengeType.SUNGLASSES: 0.677,
    ChallengeType.HEAD_TURN: 0.265,
    ChallengeType.RANDOM_PHRASE: 0.0,  # pas évalué par GOTCHA ; sert à vérifier la réactivité
}

MAX_CHALLENGE_PENALTY = 45
VIRTUAL_CAMERA_PENALTY = 25
LOCATION_MISMATCH_PENALTY = 10
CV_CONTRADICTION_PENALTY = 8
MAX_CV_PENALTY = 16
SLOW_RESPONSE_MS = 6000
SLOW_RESPONSE_PENALTY = 8
LIP_SYNC_MS = 200
LIP_SYNC_PENALTY = 10
# Détecteur passif : ~80 % de précision annoncée, donc signal moyen, plafonné bas.
FACE_CONTINUITY_PENALTY = 30  # visage différent de la pré-vérification (lunettes, barbe, lumière possibles)
PASSIVE_MIN_FRAMES = 5
PASSIVE_THRESHOLD = 0.6
PASSIVE_MAX_PENALTY = 15


def degradation(c: ChallengeResult) -> float:
    """M de GOTCHA = max(ΔF, 1 − C). Valeurs manquantes ignorées (règle n°1)."""
    parts = []
    if c.fidelity_loss is not None:
        parts.append(c.fidelity_loss)
    if c.compliance is not None:
        parts.append(1 - c.compliance)
    if parts:
        return max(parts)
    return 1.0 if c.status == ChallengeStatus.FAILED else 0.0


def _challenge_signals(inp: AssessmentInput) -> list[Signal]:
    out = []
    for c in inp.challenges:
        if c.status == ChallengeStatus.FAILED:
            m = degradation(c)
            # Un défi qui trahit fort les deepfakes (main, déformation) pèse plus qu'un défi faible (rotation).
            weight = 0.5 + 0.5 * GOTCHA_DEGRADATION[c.type]
            penalty = round(MAX_CHALLENGE_PENALTY * max(m, 0.5) * weight)
            out.append(Signal(
                id=f"challenge_failed.{c.type.value}", severity=Severity.STRONG, penalty=penalty,
                message=f"Défi « {c.type.value} » non exécuté ou image déformée pendant le défi : signal à vérifier.",
                evidence={"degradation": round(m, 2), "compliance": c.compliance, "fidelity_loss": c.fidelity_loss},
            ))
        elif c.status == ChallengeStatus.PASSED:
            out.append(Signal(id=f"challenge_passed.{c.type.value}", severity=Severity.INFO, penalty=0,
                              message=f"Défi « {c.type.value} » exécuté normalement."))
        if c.response_delay_ms is not None and c.response_delay_ms > SLOW_RESPONSE_MS:
            out.append(Signal(id=f"slow_response.{c.type.value}", severity=Severity.MEDIUM, penalty=SLOW_RESPONSE_PENALTY,
                              message="Délai de réponse inhabituellement long : signal à vérifier.",
                              evidence={"delay_ms": c.response_delay_ms}))
    return out


def _environment_signals(inp: AssessmentInput) -> list[Signal]:
    e, out = inp.environment, []
    if e.virtual_camera_detected:
        out.append(Signal(
            id="virtual_camera", severity=Severity.STRONG, penalty=VIRTUAL_CAMERA_PENALTY,
            message="Le navigateur déclare une caméra virtuelle. Un nom de périphérique n'est pas une preuve : signal à vérifier.",
            evidence={"camera_labels": e.camera_labels}))
    mismatch = []
    if e.ip_country and e.declared_country and e.ip_country.upper() != e.declared_country.upper():
        mismatch.append("pays de l'IP")
    if e.timezone_consistent is False or (
            e.browser_timezone and e.declared_timezone and e.browser_timezone != e.declared_timezone):
        mismatch.append("fuseau horaire")
    if mismatch:
        vpn = " Un VPN est signalé, ce qui peut l'expliquer (VPN d'entreprise légitime)." if e.vpn_suspected else ""
        # Un VPN suspecté explique l'incohérence : on atténue la pénalité de moitié.
        penalty = LOCATION_MISMATCH_PENALTY // 2 if e.vpn_suspected else LOCATION_MISMATCH_PENALTY
        out.append(Signal(id="location_mismatch", severity=Severity.MEDIUM, penalty=penalty,
                          message=f"Incohérence avec le lieu déclaré ({', '.join(mismatch)}).{vpn}",
                          evidence={"mismatch": mismatch, "vpn_suspected": e.vpn_suspected}))
    return out


def _other_signals(inp: AssessmentInput) -> list[Signal]:
    out = []
    if inp.cv_contradictions:
        penalty = min(MAX_CV_PENALTY, CV_CONTRADICTION_PENALTY * len(inp.cv_contradictions))
        out.append(Signal(id="cv_contradiction", severity=Severity.MEDIUM, penalty=penalty,
                          message="Contradiction entre le CV et les informations déclarées par le candidat.",
                          evidence={"items": [c.model_dump() for c in inp.cv_contradictions]}))
    if inp.face_continuity is False:
        out.append(Signal(id="face_continuity", severity=Severity.STRONG, penalty=FACE_CONTINUITY_PENALTY,
                          message="Le visage de l'entretien diffère de celui de la pré-vérification : signal à vérifier "
                                  "(lunettes, barbe ou éclairage peuvent l'expliquer)."))
    p = inp.passive
    if p and p.median_fake_probability is not None and p.frames_analyzed >= PASSIVE_MIN_FRAMES             and p.median_fake_probability >= PASSIVE_THRESHOLD:
        scale = (p.median_fake_probability - PASSIVE_THRESHOLD) / (1 - PASSIVE_THRESHOLD)
        out.append(Signal(id="passive_detector", severity=Severity.MEDIUM,
                          penalty=max(1, round(PASSIVE_MAX_PENALTY * scale)),
                          message="Le détecteur passif local juge l'image suspecte sur plusieurs captures : signal à vérifier, "
                                  "pas une preuve (le modèle se trompe environ une fois sur cinq).",
                          evidence={"median_fake_probability": p.median_fake_probability,
                                    "frames_analyzed": p.frames_analyzed}))
    off = inp.media.lip_sync_offset_ms
    if off is not None and abs(off) > LIP_SYNC_MS:
        out.append(Signal(id="lip_sync", severity=Severity.MEDIUM, penalty=LIP_SYNC_PENALTY,
                          message="Décalage lèvres / son inhabituel : signal à vérifier.", evidence={"offset_ms": off}))
    return out


def evaluate(inp: AssessmentInput) -> tuple[int | None, Level, list[Signal]]:
    signals = _challenge_signals(inp) + _environment_signals(inp) + _other_signals(inp)
    # Pas de défi concluant (réussi ou échoué) et aucun signal : on ne conclut pas « tout va bien ».
    has_challenge_evidence = any(c.status in (ChallengeStatus.PASSED, ChallengeStatus.FAILED) for c in inp.challenges)
    penalty = sum(s.penalty for s in signals)
    if not has_challenge_evidence and penalty == 0:
        return None, Level.INSUFFICIENT, signals
    score = max(0, 100 - penalty)
    level = Level.GREEN if score >= 80 else Level.ORANGE if score >= 50 else Level.RED
    # Sans aucun défi concluant, on ne peut pas affirmer le vert.
    if not has_challenge_evidence and level == Level.GREEN:
        level = Level.INSUFFICIENT
    return score, level, signals
