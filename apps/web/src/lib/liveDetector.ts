import { createApi, type ChallengeDetector, type DetectorOutcome } from '@kyc/panel';
import {
  HAND_FRAMES,
  HAND_POINTS_OVER_FACE,
  MOUTH_RANGE_SPEAKING,
  TURN_FRAMES,
  TURN_YAW_DEG,
  boundingBox,
  estimateYawDeg,
  handPointsOverFace,
  median,
  mouthOpenness,
  type ChallengeResult,
} from '@kyc/shared';
import { API_BASE } from '../config.ts';
import { detect, loadTracker } from './tracker.ts';

const FRAME_MS = 80; // ~12 analyses par seconde
const BASELINE_FRAMES = 5; // angle de départ : la caméra du candidat n'est pas toujours bien en face
const AFTER_HAND_MS = 1500; // après la main, on regarde encore un peu : un face-swap se trahit quand elle repart
const SPEECH_CYCLES = 2; // une phrase lue fait plusieurs ouvertures-fermetures de la bouche
const FRONTAL_DEG = 8; // la bouche n'est mesurée que de face : une tête tournée déforme le dessin des lèvres
const CAPTURE_MAX_WIDTH = 640;

// Défis en direct (brique B), sur le flux du candidat affiché dans le panneau, avec la même détection que la
// pré-vérification. Rien n'est enregistré : au plus une capture par défi part vers l'agent local (détecteur passif
// et empreinte), au moment où un trucage se trahit le plus (main qui repart, tête tournée).
export function createLiveDetector(sessionId: string, recruiterKey?: string): ChallengeDetector {
  const api = createApi(API_BASE, recruiterKey);
  return async (video, challenge, signal) => {
    const tracker = await loadTracker();
    return new Promise<DetectorOutcome>((resolve) => {
      const start = performance.now();
      const canvas = document.createElement('canvas');
      let frames = 0;
      let tracked = 0;
      let streak = 0;
      let lastBox: ReturnType<typeof boundingBox> | null = null;
      let captured = false;
      let done = false;
      // Main devant le visage
      let covered = 0;
      let faceUnderHand = 0;
      let passedAt = 0;
      // Rotation de la tête
      const baseline: number[] = [];
      let maxTurn = 0;
      // Phrase aléatoire : on vérifie seulement que les lèvres bougent, en comptant les cycles ouverture-fermeture
      let mouthMin = Infinity;
      let mouthMax = -Infinity;
      let mouthFrames = 0;
      let mouthOpen = false;
      let mouthLow = Infinity;
      let mouthPeak = 0;
      let mouthCycles = 0;

      const capture = () => {
        captured = true;
        const scale = Math.min(1, CAPTURE_MAX_WIDTH / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob && api.sendFrame(sessionId, blob).catch(() => undefined), 'image/jpeg', 0.85);
      };

      const metrics = (): Record<string, number> => {
        const m: Record<string, number> = { trackedRatio: frames ? tracked / frames : 0 };
        if (challenge.id === 'hand-over-face') {
          m.coverFrames = covered;
          m.faceUnderHandRatio = covered ? faceUnderHand / covered : 0;
        } else if (challenge.id === 'head-turn') {
          m.maxTurnDeg = maxTurn;
        } else if (challenge.id === 'random-phrase' && mouthFrames > 0) {
          m.mouthRange = mouthMax - mouthMin;
          m.mouthCycles = mouthCycles;
        }
        return m;
      };

      const finish = (result: ChallengeResult) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        resolve({ result, metrics: metrics() });
      };

      // Au temps écoulé : « failed » seulement si le visage était bien suivi et que rien n'a été fait.
      // La phrase n'échoue jamais : une parole peut ne pas se voir (micro, cadrage), c'est « non concluant ».
      const timedOut = (): ChallengeResult =>
        challenge.id !== 'random-phrase' && frames > 10 && tracked / frames > 0.7 ? 'failed' : 'inconclusive';

      const tick = () => {
        if (done || video.readyState < 2 || video.videoWidth === 0) return;
        const withHands = challenge.id === 'hand-over-face' || challenge.id === 'random-phrase';
        const { face, hands } = detect(tracker, video, withHands);
        const now = performance.now();
        frames += 1;
        if (face) {
          tracked += 1;
          lastBox = boundingBox(face);
        }

        if (challenge.id === 'hand-over-face') {
          // Quand la main couvre le visage, le visage disparaît souvent : on garde son dernier rectangle connu.
          const box = face ? boundingBox(face) : lastBox;
          const over = box ? Math.max(0, ...hands.map((h) => handPointsOverFace(h, box))) : 0;
          if (over >= HAND_POINTS_OVER_FACE) {
            covered += 1;
            if (face) faceUnderHand += 1;
          }
          streak = over >= HAND_POINTS_OVER_FACE ? streak + 1 : 0;
          if (!passedAt && streak >= HAND_FRAMES) passedAt = now;
          if (passedAt && !captured && face && over === 0) capture();
          if (passedAt && (captured || now - passedAt > AFTER_HAND_MS)) return finish('passed');
        } else if (challenge.id === 'head-turn') {
          if (!face) {
            streak = 0;
          } else {
            const yaw = estimateYawDeg(face, video.videoWidth);
            if (baseline.length < BASELINE_FRAMES) {
              baseline.push(yaw);
            } else {
              const turn = Math.abs(yaw - median(baseline));
              maxTurn = Math.max(maxTurn, turn);
              streak = turn >= TURN_YAW_DEG ? streak + 1 : 0;
              if (streak === 2 && !captured) capture();
              if (streak >= TURN_FRAMES) return finish('passed');
            }
          }
        } else if (challenge.id === 'random-phrase') {
          const yaw = face ? estimateYawDeg(face, video.videoWidth) : 0;
          if (face && baseline.length < BASELINE_FRAMES) baseline.push(yaw);
          const frontal = face && baseline.length >= BASELINE_FRAMES && Math.abs(yaw - median(baseline)) < FRONTAL_DEG;
          // Une main près du visage fausse le dessin des lèvres : ces images ne comptent pas.
          const handNear = face ? hands.some((h) => handPointsOverFace(h, boundingBox(face), 0.3) >= 3) : false;
          if (frontal && !handNear) {
            const o = mouthOpenness(face!, video.videoWidth, video.videoHeight);
            mouthMin = Math.min(mouthMin, o);
            mouthMax = Math.max(mouthMax, o);
            mouthFrames += 1;
            if (!mouthOpen) {
              mouthLow = Math.min(mouthLow, o);
              if (o - mouthLow >= MOUTH_RANGE_SPEAKING) {
                mouthOpen = true;
                mouthPeak = o;
              }
            } else {
              mouthPeak = Math.max(mouthPeak, o);
              if (mouthPeak - o >= MOUTH_RANGE_SPEAKING / 2) {
                mouthCycles += 1;
                mouthOpen = false;
                mouthLow = o;
              }
            }
          }
          if (mouthCycles >= SPEECH_CYCLES) return finish('passed');
        } else {
          return finish('inconclusive'); // défi sans détecteur : sans effet sur le score
        }

        if (now - start > challenge.timeoutMs) finish(passedAt ? 'passed' : timedOut());
      };

      const timer = setInterval(() => {
        try {
          tick();
        } catch {
          finish('inconclusive');
        }
      }, FRAME_MS);
      signal.addEventListener('abort', () => finish('inconclusive'));
    });
  };
}
