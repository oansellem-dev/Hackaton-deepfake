import { FaceLandmarker } from '@mediapipe/tasks-vision';
import type { Point } from '@kyc/shared';

/**
 * Maillage lumineux dessiné sur le visage pendant la vérification (habillage Oval).
 * Pur affichage : il reprend les points que la détection calcule déjà, sans rien changer à l'analyse.
 * Rien n'est enregistré : le canvas est effacé à chaque image.
 */
export type MeshTone = 'lost' | 'track' | 'ok';
const COLOR: Record<MeshTone, string> = { lost: '240,180,60', track: '120,210,255', ok: '110,240,180' };
const HAND_LINKS: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
let phase = 0;

export function drawFaceMesh(canvas: HTMLCanvasElement | null, video: HTMLVideoElement, face: Point[] | null, hands: Point[][], tone: MeshTone): void {
  if (!canvas) return;
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  phase = (phase + 1) % 120;
  const c = COLOR[tone];

  if (face) {
    // Mailles fines, très transparentes
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${c},0.22)`;
    ctx.beginPath();
    for (const { start, end } of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
      const a = face[start], b = face[end];
      if (!a || !b) continue;
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
    }
    ctx.stroke();
    // Contour du visage et des yeux, plus marqués
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = `rgba(${c},0.75)`;
    for (const set of [FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, FaceLandmarker.FACE_LANDMARKS_LIPS]) {
      ctx.beginPath();
      for (const { start, end } of set) {
        const a = face[start], b = face[end];
        if (!a || !b) continue;
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
      }
      ctx.stroke();
    }
    // Points scintillants : une étincelle qui parcourt le maillage
    for (let i = 0; i < face.length; i += 7) {
      const p = face[i];
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin((i + phase * 3) / 17));
      ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
      ctx.shadowColor = `rgba(${c},0.9)`;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  for (const hand of hands) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    for (const [i, j] of HAND_LINKS) {
      const a = hand[i], b = hand[j];
      if (!a || !b) continue;
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
    }
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function clearFaceMesh(canvas: HTMLCanvasElement | null): void {
  canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
}
