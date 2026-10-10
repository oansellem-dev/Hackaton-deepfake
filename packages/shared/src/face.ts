// Mesures du visage : proportions, angle de la tête, occlusion par la main, comparaison de deux profils.
// Logique pure (aucune dépendance à MediaPipe), utilisée par le site (pré-vérification), le panneau et le serveur.
//
// Ce qu'on garde : une dizaine de rapports de proportions. Jamais d'image, jamais les points du visage bruts.

export interface Point {
  x: number; // normalisé 0..1 par la largeur de l'image
  y: number; // normalisé 0..1 par la hauteur de l'image
  z: number; // profondeur relative, même échelle que x
}

// Indices du maillage MediaPipe FaceLandmarker (478 points, iris compris).
const IDX = {
  eyeOuterA: 33,
  eyeOuterB: 263,
  eyeInnerA: 133,
  eyeInnerB: 362,
  cheekA: 234,
  cheekB: 454,
  forehead: 10,
  chin: 152,
  noseTip: 1,
  alarA: 129,
  alarB: 358,
  mouthA: 61,
  mouthB: 291,
  irisA: 468,
  irisB: 473,
  lipUpper: 13,
  lipLower: 14,
} as const;

export const RATIO_NAMES = [
  'eye-span/face-width',
  'face-height/face-width',
  'nose-width/eye-span',
  'mouth-width/eye-span',
  'eyes-to-nose/eye-span',
  'eyes-to-mouth/face-width',
  'pupil-distance/eye-span',
  'inner-eye/eye-span',
] as const;

// Proportions mesurées tête tournée, d'un côté (yaw < 0) ou de l'autre (yaw > 0).
export interface AngleProfile {
  yawDeg: number; // angle médian des mesures
  ratios: number[];
  samples: number;
}

export interface FaceProfile {
  ratios: number[]; // de face, même ordre que RATIO_NAMES
  samples: number; // nombre de mesures de face dont c'est la médiane
  angles?: AngleProfile[]; // plusieurs angles : la visio compare au profil le plus proche de l'angle observé
  embedding?: number[]; // empreinte faciale (128 nombres, modèle SFace local), pour la comparaison 1:1 avec la visio
  createdAt: number;
}

export function isValidRatios(r: unknown): r is number[] {
  return Array.isArray(r) && r.length === RATIO_NAMES.length && r.every((n) => Number.isFinite(n) && n > 0 && n < 10);
}

const MIN_LANDMARKS = 474;

function dist(a: Point, b: Point, w: number, h: number): number {
  // x et z sont normalisés par la largeur, y par la hauteur : on remet tout en pixels.
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h, (a.z - b.z) * w);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function computeRatios(lm: Point[], width: number, height: number): number[] | null {
  if (lm.length < MIN_LANDMARKS) return null;
  const d = (a: number, b: number) => dist(lm[a], lm[b], width, height);
  const faceWidth = d(IDX.cheekA, IDX.cheekB);
  const eyeSpan = d(IDX.eyeOuterA, IDX.eyeOuterB);
  if (faceWidth < 1e-6 || eyeSpan < 1e-6) return null;

  const eyesMid = mid(lm[IDX.eyeOuterA], lm[IDX.eyeOuterB]);
  const mouthMid = mid(lm[IDX.mouthA], lm[IDX.mouthB]);
  return [
    eyeSpan / faceWidth,
    d(IDX.forehead, IDX.chin) / faceWidth,
    d(IDX.alarA, IDX.alarB) / eyeSpan,
    d(IDX.mouthA, IDX.mouthB) / eyeSpan,
    dist(eyesMid, lm[IDX.noseTip], width, height) / eyeSpan,
    dist(eyesMid, mouthMid, width, height) / faceWidth,
    d(IDX.irisA, IDX.irisB) / eyeSpan,
    d(IDX.eyeInnerA, IDX.eyeInnerB) / eyeSpan,
  ];
}

// Rotation gauche/droite en degrés, d'après la profondeur relative des deux joues. 0 = de face.
// Le signe dépend du sens du miroir : on ne s'en sert que pour vérifier que les deux virages sont opposés.
export function estimateYawDeg(lm: Point[], width: number): number {
  const a = lm[IDX.cheekA];
  const b = lm[IDX.cheekB];
  return (Math.atan2((b.z - a.z) * width, (b.x - a.x) * width) * 180) / Math.PI;
}

export function boundingBox(lm: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const p of lm) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

// Nombre de points d'une main qui tombent dans le rectangle du visage (agrandi de `margin`).
export function handPointsOverFace(
  hand: Point[],
  face: { minX: number; minY: number; maxX: number; maxY: number },
  margin = 0.1,
): number {
  const w = face.maxX - face.minX;
  const h = face.maxY - face.minY;
  return hand.filter(
    (p) =>
      p.x >= face.minX - w * margin &&
      p.x <= face.maxX + w * margin &&
      p.y >= face.minY - h * margin &&
      p.y <= face.maxY + h * margin,
  ).length;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Médiane composante par composante de plusieurs mesures de face.
export function medianRatios(samples: number[][]): number[] {
  return samples[0].map((_, i) => median(samples.map((s) => s[i])));
}

// Écart relatif moyen entre deux jeux de rapports (0 = identiques).
export function ratioDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]) / ((Math.abs(a[i]) + Math.abs(b[i])) / 2 || 1);
  return sum / n;
}

// Seuils de départ à ajuster sur nos 20 tests. Entre les deux : on ne conclut pas (règle n°1).
export const SAME_FACE_MAX = 0.07;
export const DIFFERENT_FACE_MIN = 0.12;
export const MIN_LIVE_SAMPLES = 5;
export const FRONTAL_MAX_YAW_DEG = 12; // en dessous : comparé au profil de face
export const ANGLE_MIN_YAW_DEG = 12; // mesures « tête tournée » gardées entre ces deux angles
export const ANGLE_MAX_YAW_DEG = 40;
export const ANGLE_MATCH_DEG = 12; // écart d'angle toléré avec un profil tourné
export const MIN_ANGLE_SAMPLES = 4;

// Profil de référence pour un visage observé sous l'angle `yawDeg`, ou null si aucun ne correspond.
export function referenceFor(profile: FaceProfile, yawDeg: number): number[] | null {
  if (Math.abs(yawDeg) <= FRONTAL_MAX_YAW_DEG) return profile.ratios;
  const match = (profile.angles ?? [])
    .filter((a) => Math.sign(a.yawDeg) === Math.sign(yawDeg) && Math.abs(a.yawDeg - yawDeg) <= ANGLE_MATCH_DEG)
    .sort((a, b) => Math.abs(a.yawDeg - yawDeg) - Math.abs(b.yawDeg - yawDeg))[0];
  return match?.ratios ?? null;
}

// Regroupe les mesures « tête tournée » par côté et garde la médiane de chacun (au moins MIN_ANGLE_SAMPLES).
export function angleProfiles(samples: { yawDeg: number; ratios: number[] }[]): AngleProfile[] {
  const out: AngleProfile[] = [];
  for (const side of [-1, 1]) {
    const s = samples.filter(
      (x) => Math.sign(x.yawDeg) === side && Math.abs(x.yawDeg) >= ANGLE_MIN_YAW_DEG && Math.abs(x.yawDeg) <= ANGLE_MAX_YAW_DEG,
    );
    if (s.length >= MIN_ANGLE_SAMPLES) {
      out.push({ yawDeg: median(s.map((x) => x.yawDeg)), ratios: medianRatios(s.map((x) => x.ratios)), samples: s.length });
    }
  }
  return out;
}

export type Continuity = 'consistent' | 'different' | 'unknown';

// `distances` : écarts entre le profil de pré-vérification et les mesures faites pendant l'entretien.
export function judgeContinuity(distances: number[]): Continuity {
  if (distances.length < MIN_LIVE_SAMPLES) return 'unknown';
  const m = median(distances);
  if (m <= SAME_FACE_MAX) return 'consistent';
  if (m >= DIFFERENT_FACE_MIN) return 'different';
  return 'unknown';
}

// --- Défis (pré-vérification et entretien) : mêmes seuils partout ---

// Angle estimé par MediaPipe (profondeur des joues). Mesuré en test : une rotation de 32° est vue vers 16-17°,
// et de face le bruit reste sous 2°. 14° correspond donc à une rotation volontaire.
export const TURN_YAW_DEG = 14;
export const TURN_FRAMES = 4; // images d'affilée
export const HAND_POINTS_OVER_FACE = 8; // points de la main (sur 21) dans le rectangle du visage
export const HAND_FRAMES = 4;
export const MOUTH_RANGE_SPEAKING = 0.06; // amplitude d'ouverture de la bouche qui signale une parole

// Ouverture de la bouche (lèvres internes), rapportée à l'écart des yeux : ~0 bouche fermée.
export function mouthOpenness(lm: Point[], width: number, height: number): number {
  const eyeSpan = dist(lm[IDX.eyeOuterA], lm[IDX.eyeOuterB], width, height);
  return eyeSpan > 1e-6 ? dist(lm[IDX.lipUpper], lm[IDX.lipLower], width, height) / eyeSpan : 0;
}

// --- Empreinte faciale (calculée par l'agent local à partir des captures, jamais d'image conservée) ---

export const EMBEDDING_SIZE = 128;
// Similarité cosinus médiane. Seuil publié pour SFace : 0,363. Entre les deux, on ne conclut pas.
export const SAME_PERSON_MIN = 0.4;
export const DIFFERENT_PERSON_MAX = 0.25;
export const MIN_PROFILE_EMBEDDINGS = 3;

export function isValidEmbedding(e: unknown): e is number[] {
  return Array.isArray(e) && e.length === EMBEDDING_SIZE && e.every((n) => Number.isFinite(n));
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Moyenne de plusieurs empreintes, renormalisée : plus stable qu'une seule capture.
export function meanEmbedding(list: number[][]): number[] {
  const sum = list[0].map((_, i) => list.reduce((acc, e) => acc + e[i], 0));
  const norm = Math.hypot(...sum) || 1;
  return sum.map((x) => x / norm);
}

export function judgeIdentity(similarities: number[]): Continuity {
  if (similarities.length < MIN_LIVE_SAMPLES) return 'unknown';
  const m = median(similarities);
  if (m >= SAME_PERSON_MIN) return 'consistent';
  if (m <= DIFFERENT_PERSON_MAX) return 'different';
  return 'unknown';
}

// Verdict final : un seul contrôle qui voit un visage différent suffit à lever un signal (à vérifier, jamais une preuve).
// L'empreinte prime pour dire « même personne » ; les proportions servent quand l'empreinte manque.
export function combineContinuity(identity: Continuity, geometry: Continuity): Continuity {
  if (identity === 'different' || geometry === 'different') return 'different';
  if (identity === 'consistent') return 'consistent';
  if (identity === 'unknown' && geometry === 'consistent') return 'consistent';
  return 'unknown';
}

// --- Parcours Face ID (pré-vérification) ---

export type FaceIdStep = 'center' | 'turn_a' | 'turn_b' | 'hand';

export interface FaceIdPlan {
  nonce: string;
  steps: FaceIdStep[]; // 'center' toujours en premier, le reste tiré au hasard par le serveur
  hardened: boolean; // parcours durci : des signaux à vérifier existaient déjà
}

export interface FaceIdStepResult {
  step: FaceIdStep;
  result: 'passed' | 'failed' | 'inconclusive';
  durationMs: number;
}

export interface FaceIdSubmission {
  nonce: string;
  results: FaceIdStepResult[];
  ratios: number[]; // médiane des mesures de face
  samples: number;
  angles?: AngleProfile[];
}

export const MIN_PROFILE_SAMPLES = 8;
