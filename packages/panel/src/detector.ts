import type { Challenge, ChallengeResult } from '@kyc/shared';

// Verdict accompagné de mesures brutes (affichées au rapport, utiles pour régler les seuils).
export interface DetectorOutcome {
  result: ChallengeResult;
  metrics?: Record<string, number>;
}

// Point de branchement de la brique B (moteur de défis).
// Le détecteur lit les images de `video` (le flux capturé, rien n'est enregistré)
// et renvoie son verdict avant `challenge.timeoutMs`, ou « inconclusive » à l'annulation.
// L'implémentation MediaPipe est dans le site (apps/web/src/lib/liveDetector.ts), passée au panneau en propriété.
export type ChallengeDetector = (
  video: HTMLVideoElement,
  challenge: Challenge,
  signal: AbortSignal,
) => Promise<ChallengeResult | DetectorOutcome>;

// Bouchon en attendant MediaPipe : lit les images comme le fera le vrai détecteur,
// puis répond « inconclusive », sans effet sur le score (règle n°1).
export const stubDetector: ChallengeDetector = (video, challenge, signal) =>
  new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const timer = setInterval(() => {
      if (video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      // TODO brique B : passer `canvas` à MediaPipe (FaceLandmarker / HandLandmarker) et décider ici.
    }, 100);

    const finish = (result: ChallengeResult) => {
      clearInterval(timer);
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => finish('inconclusive'), challenge.timeoutMs);
    signal.addEventListener('abort', () => finish('inconclusive'));
  });
