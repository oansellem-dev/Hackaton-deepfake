"""Reformulation de l'explication par un LLM, strictement à partir des signaux.

Le LLM ne décide de rien : le score et les signaux viennent des règles. Si la clé API manque,
si l'appel échoue, si le modèle refuse ou si la sortie invente un chiffre ou accuse le candidat,
on retombe sur le gabarit déterministe.
"""
import json
import logging
import os
import re

import anthropic

from .schemas import Level, Signal

log = logging.getLogger(__name__)

MODEL = os.getenv("EXPLAIN_MODEL", "claude-haiku-5-5")

SYSTEM = """Tu rédiges l'explication affichée au RECRUTEUR dans un panneau pendant un entretien en visio.
Tu reçois un JSON : score, niveau et signaux déjà calculés par des règles.

Règles strictes :
- 3 lignes maximum, une phrase courte par ligne, en français, sans markdown ni puce.
- Utilise uniquement les faits du JSON. N'invente aucun fait, aucun chiffre, aucune cause.
- Le score est consultatif : le recruteur décide. Dis « signal à vérifier », jamais « faux candidat », « fraude » ou « deepfake confirmé ».
- Si un VPN est signalé, mentionne qu'il peut expliquer une incohérence de lieu.
- Ne mentionne pas l'absence d'un signal comme un défaut : l'absence de trace ne pénalise jamais.
- Pas d'émotions, pas de jugement sur la personne, aucune identification.
Réponds uniquement par les lignes d'explication."""

_FORBIDDEN = re.compile(r"faux candidat|fraud|usurp|imposteur|mensonge|ment\b|coupable", re.I)


def _facts(score: int | None, level: Level, signals: list[Signal]) -> dict:
    return {
        "score": score,
        "niveau": level.value,
        "signaux": [{"id": s.id, "gravite": s.severity.value, "message": s.message, "details": s.evidence}
                    for s in signals if s.penalty > 0 or s.id.startswith("challenge_passed")],
    }


def _numbers(text: str) -> set[str]:
    return set(re.findall(r"\d+", text))


def _valid(text: str, facts: dict) -> bool:
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not 1 <= len(lines) <= 3 or _FORBIDDEN.search(text):
        return False
    # Aucun chiffre qui ne figure pas dans les faits transmis (le score, les durées, les indices de défi).
    return _numbers(text) <= _numbers(json.dumps(facts, ensure_ascii=False)) | {"100"}


def rewrite(score: int | None, level: Level, signals: list[Signal], client: anthropic.Anthropic | None = None) -> str | None:
    """Renvoie l'explication reformulée, ou None pour que l'appelant garde le gabarit."""
    if level == Level.INSUFFICIENT:
        return None  # rien à expliquer : le gabarit suffit
    if client is None:
        if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
            return None
        client = anthropic.Anthropic(timeout=10.0, max_retries=1)
    facts = _facts(score, level, signals)
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            system=SYSTEM,
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": json.dumps(facts, ensure_ascii=False)}],
        )
    except anthropic.APIError as e:
        log.warning("Explication LLM indisponible, gabarit utilisé : %s", e)
        return None
    if resp.stop_reason != "end_turn":  # refusal, max_tokens...
        return None
    text = next((b.text for b in resp.content if b.type == "text"), "").strip()
    if not _valid(text, facts):
        log.warning("Sortie LLM rejetée (format, chiffre inventé ou ton accusateur) : %r", text)
        return None
    return text
