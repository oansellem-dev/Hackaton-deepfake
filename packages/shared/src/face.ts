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

export interface FaceProfile {
  ratios: number[]; // même ordre que RATIO_NAMES
  samples: number; // nombre de mesures de face dont c'est la médiane
  createdAt: number;
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
export const LIVE_MAX_YAW_DEG = 15;

export type Continuity = 'consistent' | 'different' | 'unknown';

// `distances` : écarts entre le profil de pré-vérification et les mesures faites pendant l'entretien.
export function judgeContinuity(distances: number[]): Continuity {
  if (distances.length < MIN_LIVE_SAMPLES) return 'unknown';
  const m = median(distances);
  if (m <= SAME_FACE_MAX) return 'consistent';
  if (m >= DIFFERENT_FACE_MIN) return 'different';
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
}

export const MIN_PROFILE_SAMPLES = 8;
