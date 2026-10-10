import * as ort from 'onnxruntime-web/wasm';
import { boundingBox, type Point } from '@kyc/shared';

// Empreinte faciale (SFace) et détecteur passif de face-swap (DeepfakeGuard), exécutés dans le navigateur avec
// ONNX Runtime : l'image du visage ne quitte jamais l'appareil, seuls des nombres partent au serveur.
ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1; // sans isolation cross-origin, le WASM multi-fils n'est pas disponible
ort.env.logLevel = 'error';

interface Models {
  sface: ort.InferenceSession;
  guard: ort.InferenceSession;
}

let loading: Promise<Models> | null = null;

export function loadFaceModels(): Promise<Models> {
  loading ??= (async () => {
    // logSeverityLevel 3 : erreurs seulement (SFace déclenche des avertissements d'optimisation sans conséquence).
    const options: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], logSeverityLevel: 3 };
    const [sface, guard] = await Promise.all([
      ort.InferenceSession.create('/models/face_recognition_sface_2021dec.onnx', options),
      ort.InferenceSession.create('/models/deepfakeguard_v2.onnx', options),
    ]);
    return { sface, guard };
  })();
  loading.catch(() => (loading = null));
  return loading;
}

// Gabarit d'alignement de SFace (le même qu'OpenCV FaceRecognizerSF::alignCrop) : centres des yeux, bout du nez,
// coins de la bouche, dans une image de 112 × 112.
const TEMPLATE = [
  [38.2946, 51.6963],
  [73.5318, 51.5014],
  [56.0252, 71.7366],
  [41.5493, 92.3655],
  [70.7299, 92.2041],
];
const IRIS_A = 468;
const IRIS_B = 473;
const NOSE_TIP = 1;
const MOUTH_A = 61;
const MOUTH_B = 291;
const ALIGNED = 112;
const GUARD = 224;
const GUARD_MARGIN = 0.18; // marge autour du visage utilisée à l'entraînement de DeepfakeGuard

// Similitude (rotation, échelle, translation) qui envoie au mieux les points `src` sur `dst` (moindres carrés).
function similarity(src: number[][], dst: number[][]) {
  const n = src.length;
  const ms = [0, 0];
  const md = [0, 0];
  for (let i = 0; i < n; i++) {
    ms[0] += src[i][0] / n;
    ms[1] += src[i][1] / n;
    md[0] += dst[i][0] / n;
    md[1] += dst[i][1] / n;
  }
  let p = 0;
  let q = 0;
  let norm = 0;
  for (let i = 0; i < n; i++) {
    const sx = src[i][0] - ms[0];
    const sy = src[i][1] - ms[1];
    const dx = dst[i][0] - md[0];
    const dy = dst[i][1] - md[1];
    p += sx * dx + sy * dy;
    q += sx * dy - sy * dx;
    norm += sx * sx + sy * sy;
  }
  const a = p / norm; // échelle × cos(angle)
  const b = q / norm; // échelle × sin(angle)
  return { a, b, tx: md[0] - (a * ms[0] - b * ms[1]), ty: md[1] - (b * ms[0] + a * ms[1]) };
}

let alignCanvas: HTMLCanvasElement | null = null;
let guardCanvas: HTMLCanvasElement | null = null;

function canvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Ce qu'il faut garder d'une image pour l'analyser plus tard : deux petits tableaux de nombres, pas l'image.
export interface FaceSnapshot {
  embeddingInput: Float32Array; // visage aligné 112 × 112, RVB, canaux séparés
  guardInput: Float32Array; // visage recadré 224 × 224, RVB entrelacé
}

// Prise synchrone : l'image vidéo change à chaque instant, on fige le visage avant l'analyse (asynchrone).
export function snapshotFace(video: HTMLVideoElement, face: Point[]): FaceSnapshot {
  const W = video.videoWidth;
  const H = video.videoHeight;
  const px = (i: number) => [face[i].x * W, face[i].y * H];
  // Ordre de gauche à droite de l'image, comme le gabarit (indépendant de la convention gauche/droite du maillage).
  const eyes = [px(IRIS_A), px(IRIS_B)].sort((u, v) => u[0] - v[0]);
  const mouth = [px(MOUTH_A), px(MOUTH_B)].sort((u, v) => u[0] - v[0]);
  const m = similarity([eyes[0], eyes[1], px(NOSE_TIP), mouth[0], mouth[1]], TEMPLATE);

  alignCanvas ??= canvas(ALIGNED);
  const actx = alignCanvas.getContext('2d', { willReadFrequently: true })!;
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.clearRect(0, 0, ALIGNED, ALIGNED);
  actx.setTransform(m.a, m.b, -m.b, m.a, m.tx, m.ty);
  actx.drawImage(video, 0, 0);
  actx.setTransform(1, 0, 0, 1, 0, 0);
  const a = actx.getImageData(0, 0, ALIGNED, ALIGNED).data;
  const plane = ALIGNED * ALIGNED;
  const embeddingInput = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    embeddingInput[i] = a[i * 4];
    embeddingInput[plane + i] = a[i * 4 + 1];
    embeddingInput[2 * plane + i] = a[i * 4 + 2];
  }

  const box = boundingBox(face);
  const bw = (box.maxX - box.minX) * W;
  const bh = (box.maxY - box.minY) * H;
  const x0 = Math.max(0, box.minX * W - GUARD_MARGIN * bw);
  const y0 = Math.max(0, box.minY * H - GUARD_MARGIN * bh);
  const x1 = Math.min(W, box.maxX * W + GUARD_MARGIN * bw);
  const y1 = Math.min(H, box.maxY * H + GUARD_MARGIN * bh);
  guardCanvas ??= canvas(GUARD);
  const gctx = guardCanvas.getContext('2d', { willReadFrequently: true })!;
  gctx.drawImage(video, x0, y0, x1 - x0, y1 - y0, 0, 0, GUARD, GUARD);
  const g = gctx.getImageData(0, 0, GUARD, GUARD).data;
  const guardInput = new Float32Array(GUARD * GUARD * 3);
  for (let i = 0, j = 0; i < g.length; i += 4) {
    guardInput[j++] = g[i];
    guardInput[j++] = g[i + 1];
    guardInput[j++] = g[i + 2];
  }
  return { embeddingInput, guardInput };
}

let queue: Promise<unknown> = Promise.resolve();

// Une seule analyse à la fois : une session ONNX ne peut pas tourner deux fois en parallèle.
export function analyzeSnapshot(s: FaceSnapshot): Promise<{ embedding: number[]; fakeProbability: number }> {
  const run = queue.then(async () => {
    const { sface, guard } = await loadFaceModels();
    const e = await sface.run({
      [sface.inputNames[0]]: new ort.Tensor('float32', s.embeddingInput, [1, 3, ALIGNED, ALIGNED]),
    });
    const raw = e[sface.outputNames[0]].data as Float32Array;
    const norm = Math.hypot(...raw) || 1;
    const g = await guard.run({ [guard.inputNames[0]]: new ort.Tensor('float32', s.guardInput, [1, GUARD, GUARD, 3]) });
    const pReal = (g[guard.outputNames[0]].data as Float32Array)[0];
    return {
      embedding: Array.from(raw, (x) => Math.round((x / norm) * 1e6) / 1e6),
      fakeProbability: Math.round((1 - pReal) * 1e4) / 1e4,
    };
  });
  queue = run.catch(() => undefined);
  return run;
}
