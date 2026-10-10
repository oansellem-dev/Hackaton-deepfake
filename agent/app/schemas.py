"""Format JSON échangé entre les briques A/B/C et l'agent de score et recommandation.

Règle de conception n°1 : une valeur absente (None / not_performed / pending) ne pénalise jamais.
Seules les contradictions et les défis échoués comptent.
"""
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ChallengeType(str, Enum):
    # Inspirés de GOTCHA (Mittal et al., EuroS&P 2024). Défis volontairement exclus :
    # « alter expression » (analyse d'émotions interdite, règle 4), « tongue » et « flash »
    # (peu naturels en entretien, et le flash prête à confusion même pour des humains).
    HAND_OCCLUSION = "hand_occlusion"
    HEAD_TURN = "head_turn"
    FINGER_PRESS = "finger_press"  # manual deformation : doigt appuyé sur la joue
    SUNGLASSES = "sunglasses"
    FACEMASK = "facemask"
    RANDOM_PHRASE = "random_phrase"


class ChallengeStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    INCONCLUSIVE = "inconclusive"  # image trop sombre, face non détectée... : ne pénalise pas
    NOT_PERFORMED = "not_performed"  # défi jamais proposé : ne pénalise pas
    PENDING = "pending"


class ChallengeResult(BaseModel):
    type: ChallengeType
    status: ChallengeStatus
    compliance: float | None = Field(None, ge=0, le=1, description="C de GOTCHA : l'action a-t-elle été faite (0..1)")
    fidelity_loss: float | None = Field(None, ge=0, le=1, description="ΔF de GOTCHA : dégradation de l'image pendant le défi (0..1)")
    response_delay_ms: int | None = Field(None, ge=0)
    phase: Literal["precheck", "live"] = "live"  # pré-vérification (sans recruteur) ou entretien


class Environment(BaseModel):
    """Signaux de la brique A (page de pré-vérification)."""

    virtual_camera_detected: bool | None = None
    camera_labels: list[str] = []
    vpn_suspected: bool | None = None
    timezone_consistent: bool | None = None  # fuseau du navigateur cohérent avec le pays déclaré
    browser_timezone: str | None = None
    declared_timezone: str | None = None
    ip_country: str | None = None
    declared_country: str | None = None
    browser_language: str | None = None
    declared_language: str | None = None


class CvContradiction(BaseModel):
    field: str
    detail: str


class Media(BaseModel):
    lip_sync_offset_ms: int | None = None


class PassiveSummary(BaseModel):
    """Résumé du détecteur passif local (modèle de face-swap) sur les dernières images du candidat."""

    frames_analyzed: int = 0
    median_fake_probability: float | None = Field(None, ge=0, le=1)


class AssessmentInput(BaseModel):
    session_id: str
    environment: Environment = Environment()
    challenges: list[ChallengeResult] = []
    cv_contradictions: list[CvContradiction] = []  # uniquement du texte fourni par le candidat
    media: Media = Media()
    passive: PassiveSummary | None = None  # rempli par le serveur depuis /frame si absent
    face_continuity: bool | None = None  # visage de l'entretien cohérent avec celui de la pré-vérification ; None = non mesuré
    available_challenges: list[ChallengeType] | None = None  # défis que le panneau sait détecter ; None = tous


class Severity(str, Enum):
    STRONG = "strong"
    MEDIUM = "medium"
    INFO = "info"


class Signal(BaseModel):
    id: str
    severity: Severity
    penalty: int  # points retirés au score (0 pour une info)
    message: str  # formulation « signal à vérifier », jamais accusatoire
    evidence: dict = {}


class Level(str, Enum):
    GREEN = "green"
    ORANGE = "orange"
    RED = "red"
    INSUFFICIENT = "insufficient_data"


class Recommendation(BaseModel):
    challenge: ChallengeType
    phrase: str  # phrase naturelle que le recruteur peut dire
    rationale: str  # pourquoi ce défi est utile (uniquement pour le recruteur)


class AssessmentOutput(BaseModel):
    session_id: str
    score: int | None  # fiabilité 0..100, None si données insuffisantes
    level: Level
    signals: list[Signal]
    explanation: str
    recommendations: list[Recommendation]
    passive: PassiveSummary | None = None  # résumé du détecteur passif, pour le rapport du recruteur
    advisory: str = "Score consultatif : le recruteur décide. Signal à vérifier, pas une accusation."
