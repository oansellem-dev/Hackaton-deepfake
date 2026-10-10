// Prépare les fichiers MediaPipe servis en local (aucun appel à un CDN au moment de l'entretien) :
// copie le WASM depuis node_modules et télécharge les deux modèles s'ils sont absents.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const wasmSrc = join(root, '../../node_modules/@mediapipe/tasks-vision/wasm');
const wasmDst = join(root, 'public/mediapipe-wasm');
const modelDir = join(root, 'public/models');
mkdirSync(wasmDst, { recursive: true });
mkdirSync(modelDir, { recursive: true });
for (const f of readdirSync(wasmSrc)) copyFileSync(join(wasmSrc, f), join(wasmDst, f));

const MODELS = {
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};
for (const [name, url] of Object.entries(MODELS)) {
  const dst = join(modelDir, name);
  if (existsSync(dst)) continue;
  console.log(`Téléchargement de ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
}
