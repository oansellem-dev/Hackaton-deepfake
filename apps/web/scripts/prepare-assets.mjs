// Prépare les fichiers servis par notre propre site (aucun appel à un CDN pendant l'entretien) :
// moteurs WASM de MediaPipe et d'ONNX Runtime copiés depuis node_modules, modèles téléchargés s'ils sont absents.
// Tous les calculs sur le visage se font dans le navigateur : aucune image n'est envoyée au serveur.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const modules = join(root, '../../node_modules');
const modelDir = join(root, 'public/models');
mkdirSync(modelDir, { recursive: true });

function copyDir(src, dst, keep = () => true) {
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src).filter(keep)) copyFileSync(join(src, f), join(dst, f));
}

copyDir(join(modules, '@mediapipe/tasks-vision/wasm'), join(root, 'public/mediapipe-wasm'));
copyDir(join(modules, 'onnxruntime-web/dist'), join(root, 'public/ort'), (f) =>
  /^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(f),
);

const MODELS = {
  // Visage et mains (MediaPipe, Apache 2.0)
  'face_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'hand_landmarker.task':
    'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  // Empreinte faciale (SFace, OpenCV Zoo, Apache 2.0)
  'face_recognition_sface_2021dec.onnx':
    'https://huggingface.co/opencv/face_recognition_sface/resolve/main/face_recognition_sface_2021dec.onnx',
  // Détecteur passif de face-swap (DeepfakeGuard V2, licence recherche / non commerciale)
  'deepfakeguard_v2.onnx': 'https://huggingface.co/Samson5827/deepfakeguard-v2/resolve/main/deepfakeguard_v2.onnx',
};
for (const [name, url] of Object.entries(MODELS)) {
  const dst = join(modelDir, name);
  if (existsSync(dst)) continue;
  console.log(`Téléchargement de ${name}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
}
