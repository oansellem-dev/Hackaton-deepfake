import { FLASH_CSS, FLASH_DEFAULTS, boundingBox, type FlashRun, type FlashSample, type FlashSegment, type Point } from '@kyc/shared';
import { detect, loadTracker } from './tracker.ts';

// Déroulé du test du reflet dans le navigateur : l'élément `stage` (en plein écran) prend les couleurs de la suite,
// et chaque image de `video` donne la couleur moyenne de la zone du visage. Rien ne quitte le navigateur ici.

// Valeurs des pixels (sRGB, gamma) → lumière linéaire : c'est en lumière linéaire que le reflet s'ajoute.
const LINEAR = Float32Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const PATCH = 32; // zone du visage réduite à 32 × 32 pixels avant la moyenne
const DETECT_EVERY_MS = 250; // MediaPipe suit le visage 4 fois par seconde, assez pour quelqu'un d'immobile
const FACE_TTL_MS = 700; // une détection reste valable 0,7 s

export type FlashClock = 'capture' | 'presentation' | 'animation';

export interface FlashRunResult extends FlashRun {
  clock: FlashClock; // horloge des images : instant de capture (le plus précis), d'affichage, ou d'animation (repli)
}

export interface FlashRunOptions {
  video: HTMLVideoElement; // flux en lecture, à l'intérieur de `stage` pour rester affiché en plein écran
  stage: HTMLElement;
  segments: FlashSegment[];
  leadInMs?: number;
  tailMs?: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

// Plein écran pour éclairer le visage au maximum. Appelé directement dans le clic (geste de l'utilisateur) ;
// en cas de refus, le test continue en couvrant seulement la fenêtre.
export function enterFullscreen(el: HTMLElement): Promise<void> {
  if (document.fullscreenElement || !el.requestFullscreen) return Promise.resolve();
  return el.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
}

export function exitFullscreen(): void {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}

export class FlashAborted extends Error {
  constructor(message = 'Test interrompu') {
    super(message);
  }
}

// Attend un visage dans l'image (jusqu'à `timeoutMs`). Sans suivi du visage possible, on considère qu'il est là :
// l'analyse le signalera si besoin, et une panne de notre côté ne doit jamais bloquer le candidat.
export async function waitForFace(video: HTMLVideoElement, timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
  const tracker = await loadTracker().catch(() => null);
  if (!tracker) return true;
  const end = performance.now() + timeoutMs;
  while (performance.now() < end) {
    if (signal?.aborted) throw new FlashAborted();
    try {
      if (video.readyState >= 2 && detect(tracker, video).face) return true;
    } catch {
      return true;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

export async function runFlash({
  video,
  stage,
  segments,
  leadInMs = FLASH_DEFAULTS.leadInMs,
  tailMs = FLASH_DEFAULTS.tailMs,
  signal,
  onProgress,
}: FlashRunOptions): Promise<FlashRunResult> {
  let tracker = await loadTracker().catch(() => null);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PATCH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';

  // Plan d'affichage : blanc (la caméra s'adapte), la suite, puis blanc (dernières images de la dernière couleur).
  const plan = [
    { css: FLASH_CSS.white, ms: leadInMs, segment: -1 },
    ...segments.map((s, i) => ({ css: FLASH_CSS[s.color], ms: s.durationMs, segment: i })),
    { css: FLASH_CSS.white, ms: tailMs, segment: segments.length },
  ];
  const total = plan.reduce((sum, p) => sum + p.ms, 0);
  const shownAt: number[] = [];
  let endAt = 0;
  const samples: FlashSample[] = [];
  let clock: FlashClock = 'animation';

  let roi = { x: 0.35, y: 0.3, w: 0.3, h: 0.4 }; // centre de l'image tant qu'aucun visage n'est suivi
  let lastDetect = -Infinity;
  let lastFace = tracker ? -Infinity : Infinity;

  const measure = (t: number) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    if (tracker && t - lastDetect >= DETECT_EVERY_MS) {
      lastDetect = t;
      let face: Point[] | null = null;
      try {
        face = detect(tracker, video).face;
      } catch {
        // Suivi du visage en panne : on continue sur le centre de l'image plutôt que d'arrêter la mesure.
        tracker = null;
        lastFace = Infinity;
      }
      if (face) {
        const b = boundingBox(face);
        const bw = b.maxX - b.minX;
        const bh = b.maxY - b.minY;
        // Centre du visage (joues, nez, front), sans cheveux ni arrière-plan.
        roi = { x: b.minX + 0.2 * bw, y: b.minY + 0.2 * bh, w: 0.6 * bw, h: 0.6 * bh };
        lastFace = t;
      }
    }
    ctx.drawImage(video, roi.x * w, roi.y * h, roi.w * w, roi.h * h, 0, 0, PATCH, PATCH);
    const px = ctx.getImageData(0, 0, PATCH, PATCH).data;
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < px.length; i += 4) {
      r += LINEAR[px[i]];
      g += LINEAR[px[i + 1]];
      b += LINEAR[px[i + 2]];
    }
    const n = px.length / 4;
    samples.push({ t, rgb: [r / n, g / n, b / n], face: t - lastFace <= FACE_TTL_MS });
  };

  return new Promise<FlashRunResult>((resolve, reject) => {
    let raf = 0;
    let running = true;
    const useFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

    const cleanup = () => {
      running = false;
      cancelAnimationFrame(raf);
      stage.style.background = '';
      signal?.removeEventListener('abort', onAbort);
      document.removeEventListener('visibilitychange', onHidden);
    };
    const fail = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onAbort = () => fail(new FlashAborted());
    const onHidden = () => document.hidden && fail(new FlashAborted('Test interrompu : la page a été masquée'));
    signal?.addEventListener('abort', onAbort);
    document.addEventListener('visibilitychange', onHidden);
    if (signal?.aborted) return onAbort();

    // Chaque image de la caméra, avec son instant de capture quand le navigateur le donne.
    const onFrame = (now: number, meta: VideoFrameCallbackMetadata) => {
      if (!running) return;
      let t = now;
      if (meta.captureTime !== undefined && Math.abs(meta.captureTime - now) < 1000) {
        t = meta.captureTime;
        clock = 'capture';
      } else {
        t = meta.presentationTime ?? now;
        clock = 'presentation';
      }
      video.requestVideoFrameCallback(onFrame); // d'abord : une image ratée ne doit pas arrêter la boucle
      measure(t);
    };
    if (useFrameCallback) video.requestVideoFrameCallback(onFrame);

    let start = 0;
    let shown = -1;
    let lastProgress = -Infinity; // la page n'est redessinée que 10 fois par seconde pendant l'essai
    const paint = (ts: number) => {
      if (!running) return;
      if (!start) start = ts;
      const elapsed = ts - start;
      let k = 0;
      for (let acc = plan[0].ms; k < plan.length - 1 && elapsed >= acc; acc += plan[++k].ms);
      if (k !== shown) {
        stage.style.background = plan[k].css;
        // Instant de l'image où la couleur est dessinée (même horloge que les images de la caméra). Si la page a
        // sauté une couleur (onglet ralenti), elle est notée sans durée : l'analyse n'y trouvera aucune image.
        for (let j = shown + 1; j <= k; j++) {
          if (plan[j].segment >= 0 && plan[j].segment < segments.length) shownAt[plan[j].segment] = ts;
          if (plan[j].segment === segments.length) endAt = ts;
        }
        shown = k;
      }
      if (!useFrameCallback) measure(ts); // navigateur sans requestVideoFrameCallback : une mesure par affichage
      if (elapsed - lastProgress >= 100 || elapsed >= total) {
        lastProgress = elapsed;
        onProgress?.(Math.min(1, elapsed / total));
      }
      if (elapsed >= total) {
        cleanup();
        resolve({ segments, shownAt, endAt, samples, clock: useFrameCallback ? clock : 'animation' });
        return;
      }
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
  });
}

// Source aléatoire sûre pour tirer la suite de couleurs (impossible à prévoir pour une image préparée à l'avance).
export function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
