import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  boundingBox, computeRatios, estimateYawDeg, handPointsOverFace, judgeContinuity, medianRatios, ratioDistance,
  type Point,
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
