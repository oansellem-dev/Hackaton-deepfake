// Test du reflet de l'écran (pré-vérification, après la vérification du visage).
//
// L'écran du candidat affiche une suite de couleurs tirée au hasard. Un vrai visage, éclairé par l'écran, renvoie
// ces couleurs vers la caméra avec un léger retard. Une image injectée (caméra virtuelle, vidéo rejouée, visage de
// synthèse) ne voit pas l'écran du candidat : elle ne suit pas la suite.
//
// Logique pure, sans navigateur : utilisée par la pré-vérification, l'espace de test (/lab/flash), le serveur et
// les tests. Les mesures image par image restent dans le navigateur (la couleur de la peau image par image peut
// trahir le pouls, une donnée de santé) : seul le résumé d'un essai part au serveur.

import type { Severity, Signal } from './types.ts';

export type FlashColor = 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta';
export type Rgb = [number, number, number];

// Couleurs pures : ce sont elles qui déplacent le plus la teinte du visage.
export const FLASH_COLORS: Record<FlashColor, Rgb> = {
  red: [1, 0, 0],
  green: [0, 1, 0],
  blue: [0, 0, 1],
  yellow: [1, 1, 0],
  cyan: [0, 1, 1],
  magenta: [1, 0, 1],
};

export const FLASH_CSS: Record<FlashColor | 'white', string> = {
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  white: '#ffffff',
};

export const FLASH_COLOR_NAMES: Record<FlashColor, string> = {
  red: 'rouge',
  green: 'vert',
  blue: 'bleu',
  yellow: 'jaune',
  cyan: 'cyan',
  magenta: 'magenta',
};

export interface FlashSegment {
  color: FlashColor;
  durationMs: number;
}

// 400 ms minimum par couleur : au plus 2,5 changements par seconde, sous le seuil de 3 flashs par seconde
// des règles d'accessibilité (WCAG 2.3.1). Un blanc avant et après la suite laisse la caméra s'adapter.
export const FLASH_DEFAULTS = {
  segments: 12,
  minMs: 400,
  maxMs: 600,
  leadInMs: 1000,
  tailMs: 600,
};

export const FLASH_MAX_ATTEMPTS = 2;

// Gravité d'un « aucune réaction » : moyenne, car une pièce très éclairée ou un écran sombre peuvent l'expliquer.
export const FLASH_SEVERITY: Severity = 'medium';

// Seuils de décision, à ajuster avec l'espace de test (20 essais : 10 vrais visages, 10 attaques).
export const FLASH_THRESHOLDS = {
  minFps: 8, // en dessous, trop peu d'images par couleur
  minFaceCoverage: 0.6, // part des images où le visage est suivi
  minValidSegments: 0.75, // part des couleurs mesurées avec au moins 2 images
  passMaxP: 0.01, // réussi : moins d'une chance sur 100 d'obtenir cet accord avec une suite prise au hasard…
  passMinCorrelation: 0.5, // … et un accord net
  failMinP: 0.05, // échec : l'image ne suit pas la vraie suite mieux qu'une suite prise au hasard…
  failMaxCorrelation: 0.4, // … et l'accord reste faible (un vrai visage, même mal éclairé, dépasse en général 0,5)
  // Teinte quasi immobile (en points) : même sans reflet, le bruit d'une vraie caméra dépasse largement ce seuil.
  // En dessous, l'image est figée ou de synthèse : échec, sauf si elle suit nettement l'écran.
  frozenMaxAmplitude: 0.02,
};

// Retards caméra essayés : de l'affichage d'une couleur à son reflet dans l'image.
export const FLASH_LAGS_MS = Array.from({ length: 26 }, (_, i) => i * 20);
// Images ignorées au début de chaque couleur (transition de l'écran, temps de pose de la caméra). Court, pour que
// le retard estimé reste précis : c'est la recherche du retard qui écarte le reste des images de transition.
const SETTLE_MS = 40;
const MIN_FRAMES_PER_SEGMENT = 2;
const MIN_DISTINCT_COLORS = 4;
// Variation de teinte en dessous de laquelle l'image est figée (le bruit d'une vraie caméra est des millions de fois plus fort).
const FROZEN_ENERGY = 1e-12;

const COLOR_LIST = Object.keys(FLASH_COLORS) as FlashColor[];

// Couleurs tirées au hasard : jamais deux fois la même d'affilée, au moins 4 couleurs différentes.
function randomColors(count: number, random: () => number): FlashColor[] {
  for (;;) {
    const colors: FlashColor[] = [];
    for (let i = 0; i < count; i++) {
      let c: FlashColor;
      do c = COLOR_LIST[Math.floor(random() * COLOR_LIST.length)];
      while (colors.length > 0 && colors[colors.length - 1] === c);
      colors.push(c);
    }
    if (new Set(colors).size >= Math.min(MIN_DISTINCT_COLORS, count)) return colors;
  }
}

export function makeFlashSequence(
  count = FLASH_DEFAULTS.segments,
  random: () => number = Math.random,
  minMs = FLASH_DEFAULTS.minMs,
  maxMs = FLASH_DEFAULTS.maxMs,
): FlashSegment[] {
  return randomColors(count, random).map((color) => ({
    color,
    durationMs: Math.round(minMs + random() * (maxMs - minMs)),
  }));
}

// Générateur pseudo-aléatoire à graine (mulberry32) : l'analyse donne toujours le même résultat pour les mêmes mesures.
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Mesures ---

// Une image : couleur moyenne de la zone du visage, en lumière linéaire (0..1), et visage suivi ou non.
export interface FlashSample {
  t: number; // ms, même horloge que `shownAt`
  rgb: Rgb;
  face: boolean;
}

export interface FlashRun {
  segments: FlashSegment[];
  shownAt: number[]; // instant d'affichage de chaque couleur
  endAt: number; // fin de la dernière couleur
  samples: FlashSample[];
}

export type FlashResult = 'passed' | 'failed' | 'inconclusive';
export type FlashReason = 'response' | 'no-response' | 'weak-response' | 'few-frames' | 'no-face';

export interface FlashAnalysis {
  result: FlashResult;
  reason: FlashReason;
  correlation: number; // accord entre couleurs affichées et couleurs mesurées, au meilleur retard (-1..1)
  pValue: number; // chance d'un accord au moins aussi bon avec une autre suite tirée au hasard
  lagMs: number; // retard de la caméra au meilleur alignement
  amplitude: number; // ampleur de la réaction, en points de teinte (%)
  frames: number;
  fps: number;
  faceCoverage: number; // 0..1
  validSegments: number; // 0..1
  lagCurve: { lagMs: number; correlation: number | null }[];
  nullThreshold: number; // accord atteint par 1 % des suites prises au hasard (repère du graphique)
}

function chromaOf(rgb: Rgb): Rgb | null {
  const sum = rgb[0] + rgb[1] + rgb[2];
  return sum > 1e-4 ? [rgb[0] / sum, rgb[1] / sum, rgb[2] / sum] : null;
}

// Teinte moyenne mesurée pendant chaque couleur, décalée de `lag` ; null si trop peu d'images.
function segmentChroma(samples: FlashSample[], bounds: number[], lag: number): (Rgb | null)[] {
  const out: (Rgb | null)[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i] + lag + SETTLE_MS;
    const to = bounds[i + 1] + lag;
    const acc: Rgb = [0, 0, 0];
    let n = 0;
    for (const s of samples) {
      if (s.t < from || s.t >= to || !s.face) continue;
      const c = chromaOf(s.rgb);
      if (!c) continue;
      acc[0] += c[0];
      acc[1] += c[1];
      acc[2] += c[2];
      n += 1;
    }
    out.push(n >= MIN_FRAMES_PER_SEGMENT ? [acc[0] / n, acc[1] / n, acc[2] / n] : null);
  }
  return out;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// Base orthonormée {1, t, t²} sur les instants des couleurs : retirer sa projection enlève la moyenne et la dérive
// lente de la caméra (balance des blancs, exposition automatique), qu'elle soit droite ou en courbe.
function driftBasis(t: number[]): number[][] {
  const mean = t.reduce((a, b) => a + b, 0) / t.length;
  const span = Math.max(1, Math.max(...t) - Math.min(...t));
  const x = t.map((v) => (v - mean) / span);
  const basis: number[][] = [];
  for (const raw of [x.map(() => 1), x, x.map((v) => v * v)]) {
    const w = residual(raw, basis);
    const norm = Math.sqrt(dot(w, w));
    if (norm > 1e-9) basis.push(w.map((v) => v / norm));
  }
  return basis;
}

function residual(values: number[], basis: number[][]): number[] {
  const r = [...values];
  for (const b of basis) {
    const d = dot(r, b);
    for (let i = 0; i < r.length; i++) r[i] -= d * b[i];
  }
  return r;
}

// Mesures d'un retard, préparées une fois pour toutes les suites comparées : couleurs mesurées, base de dérive,
// teintes mesurées sans leur dérive (une par canal) et leur énergie.
interface LagData {
  idx: number[];
  basis: number[][];
  measured: number[][];
  energy: number;
}

function prepareLag(means: (Rgb | null)[], times: number[], minValid: number): LagData | null {
  const idx = means.flatMap((m, i) => (m ? [i] : []));
  if (idx.length < minValid) return null;
  const basis = driftBasis(idx.map((i) => times[i]));
  const measured = [0, 1, 2].map((c) => residual(idx.map((i) => means[i]![c]), basis));
  return { idx, basis, measured, energy: measured.reduce((s, m) => s + dot(m, m), 0) };
}

// Corrélation entre teintes affichées et teintes mesurées, sur les trois canaux, une fois la dérive retirée.
function correlate(emitted: Rgb[], lag: LagData): number {
  let num = 0;
  let ee = 0;
  for (let c = 0; c < 3; c++) {
    const e = residual(lag.idx.map((i) => emitted[i][c]), lag.basis);
    num += dot(e, lag.measured[c]);
    ee += dot(e, e);
  }
  // Image parfaitement figée : aucune variation, donc aucun accord (et pas une division d'arrondis).
  return ee > 0 && lag.energy > FROZEN_ENERGY ? num / Math.sqrt(ee * lag.energy) : 0;
}

function maxOf(values: (number | null)[]): number {
  let best = -Infinity;
  for (const v of values) if (v !== null) best = Math.max(best, v);
  return best;
}

export function analyzeFlash(run: FlashRun, options: { alternatives?: number; seed?: number } = {}): FlashAnalysis {
  // 1 000 suites de comparaison : environ 50 ms, et un seuil de 1 % estimé assez finement.
  const { alternatives = 1000, seed = 1 } = options;
  const { segments, shownAt, endAt, samples } = run;
  const n = segments.length;
  const bounds = [...shownAt, endAt];
  const times = segments.map((_, i) => (bounds[i] + bounds[i + 1]) / 2);
  // Au moins 6 couleurs mesurées : la dérive retire 3 degrés de liberté par canal.
  const minValid = Math.max(6, Math.ceil(n * FLASH_THRESHOLDS.minValidSegments));

  const inRun = samples.filter((s) => s.t >= shownAt[0] && s.t < endAt);
  const frames = inRun.length;
  const fps = (frames / Math.max(1, endAt - shownAt[0])) * 1000;
  const faceCoverage = frames ? inRun.filter((s) => s.face).length / frames : 0;

  const means = FLASH_LAGS_MS.map((lag) => segmentChroma(samples, bounds, lag));
  const perLag = means.map((m) => prepareLag(m, times, minValid));
  const curveOf = (colors: FlashColor[]) => {
    const emitted = colors.map((c) => chromaOf(FLASH_COLORS[c])!);
    return perLag.map((lag) => (lag ? correlate(emitted, lag) : null));
  };

  const curve = curveOf(segments.map((s) => s.color));
  const best = curve.reduce<number>((b, v, i) => (v !== null && (b < 0 || v > curve[b]!) ? i : b), -1);
  const validSegments = Math.max(0, ...means.map((m) => m.filter(Boolean).length)) / Math.max(1, n);
  const correlation = best >= 0 ? curve[best]! : 0;
  const bestLag = best >= 0 ? perLag[best]! : null;

  // Test par tirage : avec d'autres suites prises au hasard (que l'écran n'a jamais affichées), quel accord
  // obtient-on avec les mêmes mesures ? Si la vraie suite ne fait pas mieux, l'image ne réagit pas à l'écran.
  const random = seededRandom(seed);
  const nullBest: number[] = [];
  let beaten = 0;
  if (best >= 0) {
    for (let k = 0; k < alternatives; k++) {
      const s = maxOf(curveOf(randomColors(n, random)));
      nullBest.push(s);
      if (s >= correlation) beaten += 1;
    }
  }
  const pValue = best >= 0 ? (1 + beaten) / (1 + alternatives) : 1;
  nullBest.sort((a, b) => a - b);
  const nullThreshold = nullBest.length ? nullBest[Math.min(nullBest.length - 1, Math.floor(nullBest.length * 0.99))] : 1;

  const T = FLASH_THRESHOLDS;
  const amplitude = bestLag ? Math.sqrt(bestLag.energy / (3 * bestLag.idx.length)) * 100 : 0;
  let result: FlashResult = 'inconclusive';
  let reason: FlashReason = 'weak-response';
  if (fps < T.minFps || best < 0 || validSegments < T.minValidSegments) reason = 'few-frames';
  else if (faceCoverage < T.minFaceCoverage) reason = 'no-face';
  else if (pValue <= T.passMaxP && correlation >= T.passMinCorrelation) {
    result = 'passed';
    reason = 'response';
  } else if ((pValue >= T.failMinP && correlation < T.failMaxCorrelation) || amplitude < T.frozenMaxAmplitude) {
    result = 'failed';
    reason = 'no-response';
  }

  return {
    result,
    reason,
    correlation,
    pValue,
    lagMs: best >= 0 ? FLASH_LAGS_MS[best] : 0,
    amplitude,
    frames,
    fps,
    faceCoverage,
    validSegments,
    lagCurve: FLASH_LAGS_MS.map((lagMs, i) => ({ lagMs, correlation: curve[i] })),
    nullThreshold,
  };
}

// --- Résumé envoyé au serveur (aucune mesure image par image) ---

export interface FlashAttemptSummary {
  result: FlashResult;
  reason: FlashReason;
  correlation: number;
  pValue: number;
  lagMs: number;
  amplitude: number;
  frames: number;
  fps: number;
  faceCoverage: number;
}

export interface FlashSummary {
  attempts: FlashAttemptSummary[];
  final: boolean; // false : test en cours ou interrompu
  skipped: boolean; // passé par le candidat avant tout essai
  at: number;
}

// Corps de POST /api/sessions/:id/flash : un essai, ou « passer », et si c'est le dernier envoi.
export interface FlashSubmission {
  attempt?: FlashAttemptSummary;
  skipped?: boolean;
  final: boolean;
}

const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;

export function summarizeFlash(a: FlashAnalysis): FlashAttemptSummary {
  return {
    result: a.result,
    reason: a.reason,
    correlation: round(a.correlation, 3),
    pValue: round(a.pValue, 4),
    lagMs: a.lagMs,
    amplitude: round(a.amplitude, 3),
    frames: a.frames,
    fps: round(a.fps, 1),
    faceCoverage: round(a.faceCoverage, 3),
  };
}

const RESULTS: FlashResult[] = ['passed', 'failed', 'inconclusive'];
const REASONS: FlashReason[] = ['response', 'no-response', 'weak-response', 'few-frames', 'no-face'];

// Validation côté serveur : bornes et types, sinon null.
export function sanitizeFlashAttempt(x: unknown): FlashAttemptSummary | null {
  const a = x as Partial<FlashAttemptSummary> | null;
  if (!a || !RESULTS.includes(a.result as FlashResult) || !REASONS.includes(a.reason as FlashReason)) return null;
  const num = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
  const fields = {
    correlation: num(a.correlation, -1, 1),
    pValue: num(a.pValue, 0, 1),
    lagMs: num(a.lagMs, 0, 2000),
    amplitude: num(a.amplitude, 0, 100),
    frames: num(a.frames, 0, 10000),
    fps: num(a.fps, 0, 240),
    faceCoverage: num(a.faceCoverage, 0, 1),
  };
  if (Object.values(fields).some((v) => v === null)) return null;
  return { result: a.result!, reason: a.reason!, ...(fields as Omit<FlashAttemptSummary, 'result' | 'reason'>) };
}

// Plusieurs essais : un seul réussi suffit ; « échec » seulement si aucun essai n'a vu de réaction.
export function combineFlashAttempts(attempts: FlashAttemptSummary[]): {
  result: FlashResult;
  best: FlashAttemptSummary | null;
} {
  if (attempts.length === 0) return { result: 'inconclusive', best: null };
  const best = [...attempts].sort((a, b) => b.correlation - a.correlation)[0];
  const passed = attempts.find((a) => a.result === 'passed');
  if (passed) return { result: 'passed', best: passed };
  if (attempts.every((a) => a.result === 'failed')) return { result: 'failed', best };
  return { result: 'inconclusive', best };
}

const fr = (x: number, digits = 2) => x.toFixed(digits).replace('.', ',');
const essais = (n: number) => `${n} essai${n > 1 ? 's' : ''}`;

export const FLASH_REASON_TEXT: Record<FlashReason, string> = {
  response: "l'image a suivi les couleurs de l'écran",
  'no-response': "l'image n'a pas suivi les couleurs de l'écran",
  'weak-response': 'reflet trop faible pour conclure (écran peu lumineux, pièce très éclairée ou visage loin de l’écran)',
  'few-frames': 'trop peu d’images reçues de la caméra',
  'no-face': 'visage pas assez visible pendant le test',
};

// Signal du rapport (règle n°1 : seul un essai complet sans aucune réaction devient une contradiction).
export function describeFlash(summary: FlashSummary): Pick<Signal, 'status' | 'severity' | 'label' | 'detail'> {
  const severity = FLASH_SEVERITY;
  const { attempts } = summary;
  if (summary.skipped) {
    return {
      status: 'unknown',
      severity,
      label: 'Test du reflet de l’écran passé',
      detail:
        'Le candidat a choisi de passer ce test (proposé notamment en cas de sensibilité aux lumières clignotantes). Sans effet sur le score.',
    };
  }
  const { result, best } = combineFlashAttempts(attempts);
  if (!summary.final || !best) {
    return {
      status: 'unknown',
      severity,
      label: 'Test du reflet de l’écran non terminé',
      detail: best
        ? `Interrompu après ${essais(attempts.length)} (${FLASH_REASON_TEXT[best.reason]}). Sans effet sur le score.`
        : 'Pas encore commencé. Sans effet sur le score.',
    };
  }
  if (result === 'passed') {
    return {
      status: 'ok',
      severity,
      label: 'Reflet de l’écran visible sur le visage',
      detail:
        `L'image a suivi les couleurs affichées par l'écran du candidat (accord ${fr(best.correlation)}, ` +
        `retard de la caméra ${best.lagMs} ms, ${essais(attempts.length)}) : flux de caméra en direct.`,
    };
  }
  if (result === 'failed') {
    return {
      status: 'contradiction',
      severity,
      label: 'L’image n’a pas réagi aux couleurs de l’écran',
      detail:
        `Aucune réaction sur ${essais(attempts.length)} (accord ${fr(best.correlation)}, pas meilleur qu'une suite ` +
        `prise au hasard : p = ${fr(best.pValue)}). Signe possible d'une image injectée (vidéo rejouée, caméra virtuelle). ` +
        "Une pièce très éclairée ou un écran peu lumineux peuvent aussi l'expliquer : à confirmer par un défi en direct.",
    };
  }
  return {
    status: 'unknown',
    severity,
    label: 'Test du reflet de l’écran non concluant',
    detail: `${FLASH_REASON_TEXT[best.reason]} (${essais(attempts.length)}). Sans effet sur le score.`.replace(/^./, (c) => c.toUpperCase()),
  };
}
