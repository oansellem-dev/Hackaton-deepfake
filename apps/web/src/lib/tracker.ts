import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { computeRatios, estimateYawDeg, type Point } from '@kyc/shared';

// Suivi du visage et des mains, entièrement dans le navigateur. Les modèles et le WASM sont servis par notre propre site
// (voir scripts/prepare-assets.mjs) : aucune image ne part vers un tiers, aucun CDN n'est appelé pendant l'entretien.
interface Tracker {
  face: FaceLandmarker;
  hand: HandLandmarker;
}

let loading: Promise<Tracker> | null = null;

export function loadTracker(): Promise<Tracker> {
  loading ??= (async () => {
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
    const make = async (delegate: 'GPU' | 'CPU') => ({
      face: await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
      }),
      hand: await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      }),
    });
    try {
      const gpu = await make('GPU');
      // Sans WebGL utilisable, MediaPipe se crée sur le GPU puis échoue à la première image : on essaie à vide.
      const probe = document.createElement('canvas');
      probe.width = probe.height = 64;
      gpu.face.detectForVideo(probe, nextTs());
      gpu.hand.detectForVideo(probe, nextTs());
      return gpu;
    } catch {
      return make('CPU');
    }
  })();
  // Un échec de chargement ne doit pas rester en cache : on pourra réessayer.
  loading.catch(() => (loading = null));
  return loading;
}

export interface Detection {
  face: Point[] | null;
  hands: Point[][];
}

let lastTs = 0;

// MediaPipe exige des horodatages strictement croissants, même entre deux appels très rapprochés.
function nextTs(): number {
  lastTs = Math.max(performance.now(), lastTs + 1);
  return lastTs;
}

// La détection des mains coûte cher : on ne la lance que si l'étape en a besoin.
export function detect(tracker: Tracker, video: HTMLVideoElement, withHands = false): Detection {
  const ts = nextTs();
  const face = tracker.face.detectForVideo(video, ts).faceLandmarks[0] ?? null;
  const hands = withHands ? tracker.hand.detectForVideo(video, ts).landmarks : [];
  return { face, hands };
}

// Mesure d'un visage pendant l'entretien (panneau recruteur) : proportions + angle, ou null si pas de visage.
export async function sampleFace(video: HTMLVideoElement): Promise<{ ratios: number[]; yawDeg: number } | null> {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const tracker = await loadTracker();
  const face = tracker.face.detectForVideo(video, nextTs()).faceLandmarks[0];
  if (!face) return null;
  const ratios = computeRatios(face, video.videoWidth, video.videoHeight);
  return ratios ? { ratios, yawDeg: estimateYawDeg(face, video.videoWidth) } : null;
}
