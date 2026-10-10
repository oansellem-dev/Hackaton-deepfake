import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  angleProfiles, boundingBox, combineContinuity, computeRatios, cosine, estimateYawDeg, handPointsOverFace,
  isValidEmbedding, isValidRatios, judgeContinuity, judgeIdentity, meanEmbedding, medianRatios, mouthOpenness, ratioDistance,
  referenceFor, type FaceProfile, type Point,
} from '../src/face.ts';

// Visage synthétique de face : 478 points, seuls ceux utilisés par les mesures sont placés.
function fakeFace(scale = 1, yawZ = 0): Point[] {
  const lm: Point[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (i: number, x: number, y: number, z = 0) => (lm[i] = { x: 0.5 + x * scale, y: 0.5 + y * scale, z: z * scale });
  set(234, -0.2, 0, -yawZ); set(454, 0.2, 0, yawZ);     // joues
  set(33, -0.12, -0.05); set(263, 0.12, -0.05);          // coins externes des yeux
  set(133, -0.04, -0.05); set(362, 0.04, -0.05);         // coins internes
  set(468, -0.075, -0.05); set(473, 0.075, -0.05);       // iris
  set(10, 0, -0.25); set(152, 0, 0.25);                  // front, menton
  set(1, 0, 0.03, -0.04);                                // bout du nez
  set(129, -0.04, 0.05); set(358, 0.04, 0.05);           // ailes du nez
  set(61, -0.07, 0.12); set(291, 0.07, 0.12);            // bouche
  return lm;
}

test('les rapports ne dépendent pas de la distance à la caméra', () => {
  const near = computeRatios(fakeFace(1), 640, 480)!;
  const far = computeRatios(fakeFace(0.5), 640, 480)!;
  assert.ok(ratioDistance(near, far) < 0.01);
});

test('un autre visage donne un écart net', () => {
  const a = computeRatios(fakeFace(), 640, 480)!;
  const lm = fakeFace();
  lm[129] = { x: 0.5 - 0.07, y: 0.55, z: 0 }; lm[358] = { x: 0.5 + 0.07, y: 0.55, z: 0 }; // nez plus large
  lm[61] = { x: 0.5 - 0.11, y: 0.62, z: 0 }; lm[291] = { x: 0.5 + 0.11, y: 0.62, z: 0 };   // bouche plus large
  const b = computeRatios(lm, 640, 480)!;
  assert.ok(ratioDistance(a, b) > 0.12, String(ratioDistance(a, b)));
});

test('angle de la tête : nul de face, grand de profil, de signe opposé', () => {
  assert.ok(Math.abs(estimateYawDeg(fakeFace(), 640)) < 1);
  const left = estimateYawDeg(fakeFace(1, 0.15), 640);
  const right = estimateYawDeg(fakeFace(1, -0.15), 640);
  assert.ok(left > 20 && right < -20);
});

test('trop peu de points : pas de mesure', () => {
  assert.equal(computeRatios(fakeFace().slice(0, 100), 640, 480), null);
});

test('la main sur le visage est détectée, pas à côté', () => {
  const box = boundingBox(fakeFace());
  const onFace = Array.from({ length: 21 }, (_, i) => ({ x: 0.45 + i * 0.002, y: 0.5, z: 0 }));
  const away = Array.from({ length: 21 }, () => ({ x: 0.95, y: 0.9, z: 0 }));
  assert.ok(handPointsOverFace(onFace, box) >= 8);
  assert.equal(handPointsOverFace(away, box), 0);
});

test('continuité : trop peu de mesures ou zone grise = inconnu, jamais une accusation', () => {
  assert.equal(judgeContinuity([0.2, 0.2]), 'unknown');
  assert.equal(judgeContinuity([0.09, 0.09, 0.09, 0.09, 0.09]), 'unknown');
  assert.equal(judgeContinuity([0.03, 0.04, 0.03, 0.05, 0.04]), 'consistent');
  assert.equal(judgeContinuity([0.2, 0.18, 0.25, 0.22, 0.2]), 'different');
});

test('médiane de plusieurs mesures', () => {
  assert.deepEqual(medianRatios([[1, 10], [3, 30], [2, 20]]), [2, 20]);
});

test('plusieurs angles : un profil par côté, comparé au plus proche', () => {
  const r = (v: number) => Array.from({ length: 8 }, () => v);
  const samples = [
    ...[22, 25, 28, 30].map((y) => ({ yawDeg: y, ratios: r(2) })),
    ...[-24, -26, -27, -29, -31].map((y) => ({ yawDeg: y, ratios: r(3) })),
    { yawDeg: 60, ratios: r(9) }, // trop tourné : ignoré
  ];
  const angles = angleProfiles(samples);
  assert.equal(angles.length, 2);
  const profile: FaceProfile = { ratios: r(1), samples: 16, angles, createdAt: 0 };
  assert.deepEqual(referenceFor(profile, 5), r(1)); // de face
  assert.deepEqual(referenceFor(profile, 26), r(2)); // même côté, angle proche
  assert.deepEqual(referenceFor(profile, -27), r(3));
  assert.equal(referenceFor(profile, 55), null); // aucun profil à cet angle : on ne compare pas
  assert.equal(referenceFor({ ...profile, angles: [] }, 25), null);
});

test('rapports valides', () => {
  assert.ok(isValidRatios([1, 1, 1, 1, 1, 1, 1, 1]));
  assert.ok(!isValidRatios([1, 1, 1]));
  assert.ok(!isValidRatios([1, 1, 1, 1, 1, 1, 1, Number.NaN]));
});

test('empreinte : moyenne normalisée, similarité et verdict', () => {
  const a = Array.from({ length: 128 }, (_, i) => (i % 2 ? 1 : 0));
  const b = Array.from({ length: 128 }, (_, i) => (i % 2 ? 0 : 1));
  assert.ok(isValidEmbedding(a) && !isValidEmbedding(a.slice(1)));
  assert.ok(Math.abs(cosine(a, a) - 1) < 1e-9 && Math.abs(cosine(a, b)) < 1e-9);
  const m = meanEmbedding([a, a, a]);
  assert.ok(Math.abs(Math.hypot(...m) - 1) < 1e-9 && cosine(m, a) > 0.999);
  assert.equal(judgeIdentity([0.7, 0.6]), 'unknown'); // trop peu de mesures
  assert.equal(judgeIdentity([0.7, 0.65, 0.8, 0.6, 0.72]), 'consistent');
  assert.equal(judgeIdentity([0.05, -0.1, 0.1, 0.0, 0.12]), 'different');
  assert.equal(judgeIdentity([0.3, 0.32, 0.35, 0.3, 0.31]), 'unknown'); // zone grise
});

test('verdict combiné : un écart suffit, l’empreinte prime pour « même personne »', () => {
  assert.equal(combineContinuity('consistent', 'different'), 'different');
  assert.equal(combineContinuity('different', 'consistent'), 'different');
  assert.equal(combineContinuity('consistent', 'unknown'), 'consistent');
  assert.equal(combineContinuity('unknown', 'consistent'), 'consistent');
  assert.equal(combineContinuity('unknown', 'unknown'), 'unknown');
});

test('ouverture de la bouche : ~0 fermée, nette quand elle s’ouvre', () => {
  const closed = fakeFace();
  closed[13] = { x: 0.5, y: 0.62, z: 0 }; closed[14] = { x: 0.5, y: 0.62, z: 0 };
  const open = fakeFace();
  open[13] = { x: 0.5, y: 0.6, z: 0 }; open[14] = { x: 0.5, y: 0.66, z: 0 };
  assert.ok(mouthOpenness(closed, 640, 480) < 0.01);
  assert.ok(mouthOpenness(open, 640, 480) > 0.1);
});
