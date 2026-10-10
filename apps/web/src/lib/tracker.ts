import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { boundingBox, computeRatios, estimateYawDeg, type LiveSample, type Point } from '@kyc/shared';
import { analyzeSnapshot, snapshotFace } from './faceModels.ts';

// Suivi du visage et des mains, entièrement dans le navigateur. Les modèles et le WASM sont servis par notre propre site
// (voir scripts/prepare-assets.mjs) : aucune image ne part vers un tiers, aucun CDN n'est appelé pendant l'entretien.
interface Tracker {
  face: FaceLandmarker;
  hand: HandLandmarker;
}

let lastTs = 0;

// MediaPipe exige des horodatages strictement croissants, même entre deux appels très rapprochés.
function nextTs(): number {
  lastTs = Math.max(performance.now(), lastTs + 1);
  return lastTs;
}

let loading: Promise<Tracker> | null = null;

export function loadTracker(): Promise<Tracker> {
  loading ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
    const make = async (delegate: 'GPU' | 'CPU') => ({
      face: await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        // Plusieurs visages possibles (vignettes de Teams, Meet, Zoom) : on garde le plus grand, celui du candidat.
        numFaces: 4,
      }),
      hand: await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    });
    let tracker: Tracker;
    try {
      tracker = await make('GPU');
    } catch {
      tracker = await make('CPU');
    }
    // Échauffement : la toute première analyse initialise le moteur de calcul et peut prendre plusieurs secondes.
    // On la fait ici, sur une image vide, plutôt que pendant le premier défi.
    const blank = document.createElement('canvas');
    blank.width = blank.height = 64;
    tracker.face.detectForVideo(blank, nextTs());
    tracker.hand.detectForVideo(blank, nextTs());
    return tracker;
  })();
  // Un échec de chargement ne doit pas rester en cache : on pourra réessayer.
  loading.catch(() => (loading = null));
  return loading;
}

export interface Detection {
  face: Point[] | null;
  hands: Point[][];
}


export function largestFace(faces: Point[][]): Point[] | null {
  let best: Point[] | null = null;
  let bestArea = 0;
  for (const f of faces) {
    const b = boundingBox(f);
    const area = (b.maxX - b.minX) * (b.maxY - b.minY);
    if (area > bestArea) {
      bestArea = area;
      best = f;
    }
  }
  return best;
}

// La détection des mains coûte cher : on ne la lance que si l'étape en a besoin.
export function detect(tracker: Tracker, video: HTMLVideoElement, withHands = false): Detection {
  const ts = nextTs();
  const face = largestFace(tracker.face.detectForVideo(video, ts).faceLandmarks);
  const hands = withHands ? tracker.hand.detectForVideo(video, ts).landmarks : [];
  return { face, hands };
}

// Au-delà de cet angle estimé (environ la moitié de l'angle réel), l'empreinte s'éloigne même pour la bonne
// personne : on ne l'envoie pas. La comparaison se fait sur la médiane de la session, quelques profils ne la faussent pas.
const LIVE_EMBED_MAX_YAW = 30;

// Mesure du visage affiché pendant l'entretien (panneau recruteur), entièrement dans ce navigateur :
// proportions, angle, empreinte et probabilité de trucage. Aucune image n'est envoyée.
export async function sampleLive(video: HTMLVideoElement): Promise<LiveSample | null> {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const tracker = await loadTracker();
  const face = largestFace(tracker.face.detectForVideo(video, nextTs()).faceLandmarks);
  if (!face) return null;
  const yawDeg = estimateYawDeg(face, video.videoWidth);
  const sample: LiveSample = { ratios: computeRatios(face, video.videoWidth, video.videoHeight) ?? undefined, yawDeg };
  try {
    const { embedding, fakeProbability } = await analyzeSnapshot(snapshotFace(video, face));
    sample.fakeProbability = fakeProbability;
    if (Math.abs(yawDeg) <= LIVE_EMBED_MAX_YAW) sample.embedding = embedding;
  } catch {
    /* modèles indisponibles : les proportions suffisent */
  }
  return sample;
}
