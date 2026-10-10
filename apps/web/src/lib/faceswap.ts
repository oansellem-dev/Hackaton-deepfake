import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

// Filtre d'échange de visage pour l'espace de test : une attaque « deepfake » simple, en temps réel, dans le navigateur.
// Il fabrique un faux flux de caméra : chaque image de la vraie caméra, visage remplacé par celui d'une photo
// (maillage MediaPipe de 852 triangles, chaque triangle de la photo est déformé sur le visage filmé).
//
// L'analyse du reflet reçoit ce flux exactement comme une caméra : elle ne sait pas que le filtre est actif.
// Option « recopier l'éclairage » : à chaque image, la couleur moyenne du visage remplacé est recalée sur celle du vrai
// visage filmé, comme le transfert de couleur des outils de deepfake temps réel (DeepFaceLive). C'est l'attaque la plus
// difficile pour le test du reflet, puisque le reflet de l'écran sur le vrai visage est recopié sur le faux.

const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
const TRIANGLES: [number, number, number][] = [];
for (let i = 0; i + 2 < tess.length; i += 3) TRIANGLES.push([tess[i].start, tess[i + 1].start, tess[i + 2].start]);

// Le maillage laisse des trous aux ouvertures des yeux et de la bouche : sans les boucher, les vrais yeux et la vraie
// bouche de la personne filmée transparaissent (et renvoient le reflet de l'écran). Un vrai deepfake remplace tout.
const HOLES = [
  [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], // œil droit
  [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466], // œil gauche
  [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191], // intérieur des lèvres
];
for (const loop of HOLES) for (let i = 1; i + 1 < loop.length; i++) TRIANGLES.push([loop[0], loop[i], loop[i + 1]]);

// Contour du visage, dans l'ordre (les arêtes de l'ovale bout à bout).
const OVAL: number[] = (() => {
  const next = new Map(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL.map((c) => [c.start, c.end]));
  const first = FaceLandmarker.FACE_LANDMARKS_FACE_OVAL[0].start;
  const loop = [first];
  for (let p = next.get(first); p !== undefined && p !== first && loop.length <= next.size; p = next.get(p)) loop.push(p);
  return loop;
})();

const SOURCE_MAX = 640; // photo réduite : le déformer 852 fois par image reste rapide
const FPS = 30;

type Pt = [number, number];

async function createLandmarker(): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
  const make = (delegate: 'GPU' | 'CPU') =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  try {
    const gpu = await make('GPU');
    const probe = document.createElement('canvas');
    probe.width = probe.height = 64;
    gpu.detectForVideo(probe, performance.now());
    return gpu;
  } catch {
    return make('CPU');
  }
}

// Dessine le triangle `s` de l'image source sur le triangle `d` (transformation affine, découpe au triangle).
function drawTriangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Pt[], d: Pt[]) {
  const [[x0, y0], [x1, y1], [x2, y2]] = s;
  const [[u0, v0], [u1, v1], [u2, v2]] = d;
  const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(den) < 1e-6) return;
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den;
  const dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
  // Triangle de destination élargi d'un demi-pixel : pas de joints visibles entre triangles.
  const cx = (u0 + u1 + u2) / 3;
  const cy = (v0 + v1 + v2) / 3;
  const grow = (u: number, v: number): Pt => {
    const len = Math.hypot(u - cx, v - cy) || 1;
    return [u + ((u - cx) / len) * 0.6, v + ((v - cy) / len) * 0.6];
  };
  ctx.save();
  ctx.beginPath();
  for (const [i, [u, v]] of d.entries()) {
    const [gu, gv] = grow(u, v);
    if (i === 0) ctx.moveTo(gu, gv);
    else ctx.lineTo(gu, gv);
  }
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

// Couleur moyenne (sRGB, 0..255) du centre d'un visage, à partir de ses points.
function faceMean(
  probe: CanvasRenderingContext2D,
  img: CanvasImageSource,
  pts: Pt[],
): [number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 4 || h < 4) return null;
  probe.clearRect(0, 0, 16, 16);
  probe.drawImage(img, minX + 0.25 * w, minY + 0.25 * h, 0.5 * w, 0.5 * h, 0, 0, 16, 16);
  const px = probe.getImageData(0, 0, 16, 16).data;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 250) continue;
    r += px[i];
    g += px[i + 1];
    b += px[i + 2];
    n += 1;
  }
  return n ? [r / n, g / n, b / n] : null;
}

export interface FaceSwap {
  stream: MediaStream; // faux flux de caméra, à brancher comme une vraie caméra
  setMatchLighting: (on: boolean) => void;
  tracking: () => boolean; // visage filmé suivi à la dernière image
  stop: () => void;
}

export async function createFaceSwap(camera: MediaStream, face: HTMLImageElement, matchLighting: boolean): Promise<FaceSwap> {
  const landmarker = await createLandmarker();
  let ts = 0;
  const nextTs = () => (ts = Math.max(performance.now(), ts + 1));

  // Photo source, réduite, et ses points.
  const scale = Math.min(1, SOURCE_MAX / Math.max(face.naturalWidth, face.naturalHeight));
  const src = document.createElement('canvas');
  src.width = Math.round(face.naturalWidth * scale);
  src.height = Math.round(face.naturalHeight * scale);
  const srcCtx = src.getContext('2d')!;
  srcCtx.drawImage(face, 0, 0, src.width, src.height);
  // Pixels bruts plutôt que le canvas : sans WebGL, MediaPipe ne sait pas lire un canvas.
  const srcLm = landmarker.detectForVideo(srcCtx.getImageData(0, 0, src.width, src.height), nextTs()).faceLandmarks[0];
  if (!srcLm) {
    landmarker.close();
    throw new Error('Aucun visage trouvé sur la photo choisie');
  }
  const srcPts: Pt[] = srcLm.map((p) => [p.x * src.width, p.y * src.height]);

  const probe = document.createElement('canvas');
  probe.width = probe.height = 16;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true })!;
  const srcMean = faceMean(probeCtx, src, srcPts) ?? [128, 128, 128];

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = camera;
  await video.play();

  const out = document.createElement('canvas');
  const warp = document.createElement('canvas');
  const mask = document.createElement('canvas');
  const outCtx = out.getContext('2d')!;
  const warpCtx = warp.getContext('2d')!;
  const maskCtx = mask.getContext('2d')!;
  out.width = warp.width = mask.width = video.videoWidth || 640;
  out.height = warp.height = mask.height = video.videoHeight || 480;

  let lighting = matchLighting;
  let tracked = false;
  let lastDst: Pt[] | null = null;
  let lastSeen = -Infinity;

  const render = () => {
    if (video.readyState < 2 || !video.videoWidth) return;
    const W = video.videoWidth;
    const H = video.videoHeight;
    if (out.width !== W || out.height !== H) {
      out.width = warp.width = mask.width = W;
      out.height = warp.height = mask.height = H;
    }
    outCtx.drawImage(video, 0, 0, W, H);
    let lm: NormalizedLandmark[] | undefined;
    try {
      lm = landmarker.detectForVideo(video, nextTs()).faceLandmarks[0];
    } catch {
      lm = undefined;
    }
    tracked = Boolean(lm);
    const now = performance.now();
    if (lm) {
      lastDst = lm.map((p) => [p.x * W, p.y * H]);
      lastSeen = now;
    }
    // Suivi perdu un instant : le faux visage reste à sa dernière place (un attaquant ne montre pas son vrai visage).
    if (!lastDst || now - lastSeen > 1000) return;
    const dst = lastDst;

    warpCtx.globalCompositeOperation = 'source-over';
    warpCtx.globalAlpha = 1;
    warpCtx.clearRect(0, 0, W, H);
    for (const [i, j, k] of TRIANGLES) drawTriangle(warpCtx, src, [srcPts[i], srcPts[j], srcPts[k]], [dst[i], dst[j], dst[k]]);
    // Les bords des triangles sont semi-transparents : sans ça, le vrai visage transparaît par les coutures.
    // Redessiner le visage sur lui-même les rend opaques (comme le rendu d'un vrai outil de deepfake).
    for (let n = 0; n < 4; n++) warpCtx.drawImage(warp, 0, 0);

    if (lighting) {
      // Gains par canal : couleur moyenne du vrai visage filmé / couleur moyenne de la photo.
      const camMean = faceMean(probeCtx, video, dst);
      if (camMean) {
        const gains = camMean.map((m, c) => Math.min(2.5, Math.max(0.2, m / Math.max(1, srcMean[c]))));
        const gmax = Math.max(...gains);
        const ratio = gains.map((g) => g / Math.max(1, gmax));
        warpCtx.globalCompositeOperation = 'multiply';
        warpCtx.fillStyle = `rgb(${ratio.map((r) => Math.round(r * 255)).join(',')})`;
        warpCtx.fillRect(0, 0, W, H);
        // Au-delà de ×1 : on ajoute l'image à elle-même (×1 à ×2), puis encore si besoin.
        for (let extra = gmax - 1; extra > 0; extra -= 1) {
          warpCtx.globalCompositeOperation = 'lighter';
          warpCtx.globalAlpha = Math.min(1, extra);
          warpCtx.drawImage(warp, 0, 0);
        }
        warpCtx.globalAlpha = 1;
      }
    }

    // Masque du contour du visage, aux bords adoucis, pour fondre le faux visage dans l'image.
    maskCtx.clearRect(0, 0, W, H);
    maskCtx.filter = `blur(${Math.max(2, Math.round(W / 120))}px)`;
    maskCtx.fillStyle = '#000';
    maskCtx.beginPath();
    OVAL.forEach((idx, n) => (n === 0 ? maskCtx.moveTo(...dst[idx]) : maskCtx.lineTo(...dst[idx])));
    maskCtx.closePath();
    maskCtx.fill();
    maskCtx.filter = 'none';
    warpCtx.globalCompositeOperation = 'destination-in';
    warpCtx.drawImage(mask, 0, 0);
    warpCtx.globalCompositeOperation = 'source-over';

    outCtx.drawImage(warp, 0, 0);
  };

  const timer = setInterval(render, 1000 / FPS);
  const stream = out.captureStream(FPS);
  return {
    stream,
    setMatchLighting: (on) => (lighting = on),
    tracking: () => tracked,
    stop: () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      landmarker.close();
    },
  };
}
