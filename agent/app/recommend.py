"""Agent de recommandation : propose au recruteur le prochain défi (la mascotte ne parle qu'au recruteur)."""
from .schemas import (
    AssessmentInput, AssessmentOutput, ChallengeStatus, ChallengeType, Level, Recommendation, Signal,
)
from . import llm_explain
from .scoring import GOTCHA_DEGRADATION, evaluate

# Phrases naturelles, jamais des ordres ni des accusations.
PHRASES = {
    ChallengeType.HAND_OCCLUSION: ("Pouvez-vous passer la main devant votre visage, comme pour ajuster vos lunettes ?",
                                   "Occlusion par la main : le défi le plus révélateur dans GOTCHA (~91 % de dégradation)."),
    ChallengeType.FINGER_PRESS: ("Je n'entends pas bien, pouvez-vous vous gratter la joue un instant ?",
                                 "Déformation manuelle de la joue : les landmarks ne suivent pas la dépression (~83 %)."),
    ChallengeType.FACEMASK: ("Pouvez-vous vous couvrir brièvement le bas du visage avec la main ou une feuille ?",
                             "Occlusion du bas du visage (~83 %)."),
    ChallengeType.SUNGLASSES: ("Avez-vous des lunettes de soleil ? J'ai un doute sur la luminosité chez vous, essayez-les.",
                               "Occlusion des yeux (~68 %), à n'utiliser que si l'accessoire est disponible."),
    ChallengeType.HEAD_TURN: ("Pouvez-vous tourner la tête vers la fenêtre, j'ai un reflet derrière vous ?",
                              "Rotation de la tête, profil marqué : signal plus faible (~27 %), à combiner."),
    ChallengeType.RANDOM_PHRASE: ("Pouvez-vous répéter : « {phrase} » ?",
                                  "Phrase aléatoire : vérifie la réactivité et la synchro lèvres / son."),
}

# Ordre de présentation : du plus révélateur au plus faible, mais le plus facile à demander naturellement d'abord.
_ORDER = [ChallengeType.HAND_OCCLUSION, ChallengeType.FINGER_PRESS, ChallengeType.HEAD_TURN,
          ChallengeType.FACEMASK, ChallengeType.SUNGLASSES, ChallengeType.RANDOM_PHRASE]

_WORDS = ["lanterne", "violet", "horizon", "carton", "mimosa", "tracteur", "quartz", "bicyclette"]


def recommend(inp: AssessmentInput, max_items: int = 2) -> list[Recommendation]:
    done = {c.type for c in inp.challenges if c.status in (ChallengeStatus.PASSED, ChallengeStatus.FAILED)}
    suspicious = any(c.status == ChallengeStatus.FAILED for c in inp.challenges) or bool(
        inp.environment.virtual_camera_detected)
    candidates = [t for t in _ORDER if t not in done and (inp.available_challenges is None or t in inp.available_challenges)]
    # Si un signal est déjà suspect, on insiste sur les défis les plus discriminants ; sinon on garde la liste douce.
    if suspicious:
        candidates.sort(key=lambda t: -GOTCHA_DEGRADATION[t])
    recs = []
    for t in candidates[:max_items]:
        phrase, why = PHRASES[t]
        if t == ChallengeType.RANDOM_PHRASE:
            phrase = phrase.format(phrase=" ".join(_WORDS[hash(inp.session_id + str(len(done))) % len(_WORDS):][:3]))
        recs.append(Recommendation(challenge=t, phrase=phrase, rationale=why))
    return recs


def explain(score: int | None, level: Level, signals: list[Signal]) -> str:
    """Gabarit déterministe, 3 lignes maximum, uniquement à partir des signaux.

    Sert de repli quand le LLM (llm_explain.rewrite) est indisponible ou rejeté.
    """
    if level == Level.INSUFFICIENT:
        return ("Pas encore assez de données pour conclure.\n"
                "Proposer un défi au candidat pour obtenir un signal.\n"
                "L'absence de signal ne baisse jamais le score.")
    flagged = [s for s in signals if s.penalty > 0]
    lines = [f"Score de fiabilité {score}/100 ({ {'green': 'vert', 'orange': 'à surveiller', 'red': 'signaux forts'}[level.value] })."]
    lines += [s.message for s in sorted(flagged, key=lambda s: -s.penalty)[:2]]
    if not flagged:
        lines.append("Aucun signal à vérifier sur les défis réalisés.")
    return "\n".join(lines[:3])


def assess(inp: AssessmentInput) -> AssessmentOutput:
    score, level, signals = evaluate(inp)
    explanation = llm_explain.rewrite(score, level, signals) or explain(score, level, signals)
    return AssessmentOutput(session_id=inp.session_id, score=score, level=level, signals=signals,
                            explanation=explanation, recommendations=recommend(inp))
