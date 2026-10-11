import type { Score, Severity, Signal } from './types.ts';

// Poids de départ, à ajuster après les 20 tests.
export const WEIGHTS: Record<Severity, number> = {
  strong: 35,
  medium: 15,
};

// Détecteur passif (modèle local dans le navigateur du recruteur) : probabilité de trucage par capture.
// Médiane sur au moins 5 captures : au-dessus de 0,6 c'est un signal à vérifier, au-dessus de 0,8 un signal fort,
// en dessous de 0,3 une vérification positive. Entre les deux, on ne conclut pas.
export const PASSIVE_MIN_FRAMES = 5;
export const PASSIVE_FAKE_MIN = 0.6;
export const PASSIVE_STRONG_MIN = 0.8;
export const PASSIVE_REAL_MAX = 0.3;

export function passiveSignal(scores: number[], at = Date.now()): Signal {
  const n = scores.length;
  const m = n ? median(scores) : 0;
  const pct = `${Math.round(m * 100)} %`;
  const enough = n >= PASSIVE_MIN_FRAMES;
  const status: Signal['status'] = !enough ? 'unknown' : m >= PASSIVE_FAKE_MIN ? 'contradiction' : m <= PASSIVE_REAL_MAX ? 'ok' : 'unknown';
  return {
    id: 'face.passive',
    source: 'face',
    severity: m >= PASSIVE_STRONG_MIN ? 'strong' : 'medium',
    at,
    status,
    label:
      status === 'contradiction'
        ? "Image du visage jugée truquée par le détecteur"
        : status === 'ok'
          ? 'Image du visage jugée naturelle par le détecteur'
          : 'Détecteur de trucage',
    detail: !enough
      ? `${n} capture(s) analysée(s), il en faut ${PASSIVE_MIN_FRAMES} pour conclure. Sans effet sur le score.`
      : status === 'contradiction'
        ? `Probabilité de trucage médiane ${pct} sur ${n} captures (seuil ${Math.round(PASSIVE_FAKE_MIN * 100)} %). Un filtre, un visage de synthèse ou un face-swap donnent ce profil : à confirmer par un défi.`
        : status === 'ok'
          ? `Probabilité de trucage médiane ${pct} sur ${n} captures.`
          : `Probabilité de trucage médiane ${pct} sur ${n} captures : zone d'incertitude, sans effet sur le score.`,
  };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}

// Une vérification « faite » : un contrôle qui a pu conclure positivement sur la présence d'un humain réel.
// Les contrôles d'environnement (caméra, fuseau) ne comptent pas : ne rien trouver n'est pas une preuve.
export function countEvidence(signals: Signal[]): number {
  return signals.filter(
    (s) => s.status === 'ok' && (s.source === 'challenge' || s.source === 'face' || s.source === 'device' || s.id === 'precheck.screen-flash'),
  ).length;
}

export function computeScore(signals: Signal[]): Score {
  const contradictions = signals
    .filter((s) => s.status === 'contradiction')
    .sort((a, b) => WEIGHTS[b.severity] - WEIGHTS[a.severity]);

  // Règle n°1 : l'absence de trace ne baisse jamais le score.
  const penalty = contradictions.reduce((sum, s) => sum + WEIGHTS[s.severity], 0);
  const value = Math.max(0, 100 - penalty);
  const level = value >= 80 ? 'green' : value >= 50 ? 'orange' : 'red';

  const unknownCount = signals.filter((s) => s.status === 'unknown').length;
  const evidence = countEvidence(signals);

  // Lignes déterministes. Le modèle de langage (brique D) pourra les reformuler,
  // mais à partir de ces signaux uniquement, sans rien inventer.
  const explanation =
    contradictions.length === 0
      ? [
          evidence === 0
            ? "Rien n'a encore été vérifié : lancez un défi ou partagez la visio pour que l'analyse commence."
            : `Aucune contradiction relevée, ${evidence} vérification${evidence > 1 ? 's' : ''} positive${evidence > 1 ? 's' : ''}.`,
        ]
      : contradictions.slice(0, 3).map((s) => `Signal à vérifier : ${s.label}. ${s.detail}`);

  if (explanation.length < 3 && unknownCount > 0) {
    explanation.push(
      unknownCount > 1
        ? `${unknownCount} signaux non vérifiables, sans effet sur le score.`
        : '1 signal non vérifiable, sans effet sur le score.',
    );
  }

  return { value, level, explanation, evidence };
}
