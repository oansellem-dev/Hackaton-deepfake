import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FLASH_COLORS, FLASH_DEFAULTS, analyzeFlash, combineFlashAttempts, describeFlash, makeFlashSequence, sanitizeFlashAttempt,
  seededRandom, summarizeFlash, type FlashAttemptSummary, type FlashRun, type FlashSample, type Rgb,
} from '../src/flash.ts';

// Caméra simulée : peau éclairée par la pièce, plus le reflet de l'écran (`strength`), retard, bruit et balance des
// blancs automatique. strength = 0 : image injectée, qui ne voit pas l'écran.
function simulate(
  { strength = 0.03, fps = 30, lagMs = 90, face = 1, seed = 7 }: Partial<{ strength: number; fps: number; lagMs: number; face: number; seed: number }> = {},
): FlashRun {
  const rand = seededRandom(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const segments = makeFlashSequence(FLASH_DEFAULTS.segments, rand);
  const shownAt: number[] = [];
  let t = 2000;
  for (const s of segments) {
    shownAt.push(t);
    t += s.durationMs;
  }
  const endAt = t;
  const screen = (time: number): Rgb => {
    if (time < shownAt[0] || time >= endAt) return [1, 1, 1];
    let i = shownAt.length - 1;
    while (i > 0 && shownAt[i] > time) i--;
    return FLASH_COLORS[segments[i].color];
  };
  const skin = [0.35, 0.22, 0.15];
  const reflectance = [0.6, 0.4, 0.3];
  const gains = [1, 1, 1];
  const samples: FlashSample[] = [];
  for (let ft = 1000; ft < endAt + FLASH_DEFAULTS.tailMs; ft += 1000 / fps) {
    const light = screen(ft - lagMs);
    const raw = [0, 1, 2].map((c) => (skin[c] + strength * reflectance[c] * light[c]) * gains[c]);
    const mean = (raw[0] + raw[1] + raw[2]) / 3;
    for (let c = 0; c < 3; c++) gains[c] *= 1 + (mean / raw[c] - 1) / (fps * 6);
    samples.push({ t: ft, rgb: raw.map((v) => v * (1 + gauss() * 0.01)) as Rgb, face: rand() < face });
  }
  return { segments, shownAt, endAt, samples };
}

test('suite de couleurs : jamais deux fois la même, au moins 4 couleurs, au plus 2,5 changements par seconde', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const seq = makeFlashSequence(12, seededRandom(seed));
    assert.equal(seq.length, 12);
    assert.ok(new Set(seq.map((s) => s.color)).size >= 4);
    seq.forEach((s, i) => {
      assert.ok(s.durationMs >= FLASH_DEFAULTS.minMs && s.durationMs <= FLASH_DEFAULTS.maxMs);
      if (i > 0) assert.notEqual(s.color, seq[i - 1].color);
    });
    assert.ok(1000 / FLASH_DEFAULTS.minMs <= 2.5); // seuil WCAG : moins de 3 flashs par seconde
  }
});

test('un visage éclairé par l’écran réussit, avec le bon retard', () => {
  const a = analyzeFlash(simulate({ lagMs: 120 }));
  assert.equal(a.result, 'passed');
  assert.equal(a.reason, 'response');
  assert.ok(a.correlation > 0.7, `accord ${a.correlation}`);
  assert.ok(a.pValue <= 0.01);
  assert.ok(Math.abs(a.lagMs - 120) <= 60, `retard estimé ${a.lagMs} ms`);
  assert.ok(a.amplitude > 0);
});

test('une image qui ne voit pas l’écran échoue', () => {
  const failed = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => analyzeFlash(simulate({ strength: 0, seed })).result);
  assert.ok(failed.filter((r) => r === 'failed').length >= 6, failed.join(', '));
  assert.ok(!failed.includes('passed'), failed.join(', '));
});

test('une image parfaitement figée (photo, vidéo en pause) échoue', () => {
  const run = simulate({ strength: 0 });
  const frozen = { ...run, samples: run.samples.map((s) => ({ ...s, rgb: [0.3, 0.2, 0.1] as Rgb })) };
  const a = analyzeFlash(frozen);
  assert.equal(a.correlation, 0);
  assert.equal(a.result, 'failed');
});

test('trop peu d’images ou visage absent : non concluant, jamais un échec (règle n°1)', () => {
  const slow = analyzeFlash(simulate({ fps: 4 }));
  assert.equal(slow.result, 'inconclusive');
  assert.equal(slow.reason, 'few-frames');
  const noFace = analyzeFlash(simulate({ strength: 0, face: 0.3 }));
  assert.equal(noFace.result, 'inconclusive');
});

test('même mesures, même verdict', () => {
  const run = simulate({ strength: 0.01 });
  assert.deepEqual(analyzeFlash(run), analyzeFlash(run));
});

test('résumé envoyé au serveur : validé, rien d’autre que des nombres bornés', () => {
  const summary = summarizeFlash(analyzeFlash(simulate()));
  assert.deepEqual(sanitizeFlashAttempt(summary), summary);
  assert.equal(sanitizeFlashAttempt({ ...summary, result: 'ok' }), null);
  assert.equal(sanitizeFlashAttempt({ ...summary, correlation: 3 }), null);
  assert.equal(sanitizeFlashAttempt({ ...summary, frames: Number.NaN }), null);
  assert.equal(sanitizeFlashAttempt(null), null);
});

const attempt = (result: FlashAttemptSummary['result'], correlation: number): FlashAttemptSummary => ({
  result,
  reason: result === 'passed' ? 'response' : result === 'failed' ? 'no-response' : 'weak-response',
  correlation,
  pValue: result === 'passed' ? 0.001 : 0.5,
  lagMs: 100,
  amplitude: 1,
  frames: 200,
  fps: 30,
  faceCoverage: 1,
});

test('plusieurs essais : un réussi suffit, échec seulement si tous ont échoué', () => {
  assert.equal(combineFlashAttempts([attempt('failed', 0.1), attempt('passed', 0.8)]).result, 'passed');
  assert.equal(combineFlashAttempts([attempt('failed', 0.1), attempt('failed', 0.2)]).result, 'failed');
  assert.equal(combineFlashAttempts([attempt('failed', 0.1), attempt('inconclusive', 0.45)]).result, 'inconclusive');
  assert.equal(combineFlashAttempts([]).result, 'inconclusive');
});

test('signal du rapport : seule une absence de réaction sur un test terminé est une contradiction', () => {
  const at = Date.now();
  const failed = describeFlash({ attempts: [attempt('failed', 0.1), attempt('failed', 0.05)], final: true, skipped: false, at });
  assert.equal(failed.status, 'contradiction');
  assert.equal(failed.severity, 'medium');
  assert.ok(!/faux candidat|fraude/i.test(failed.label + failed.detail));
  assert.equal(describeFlash({ attempts: [attempt('passed', 0.9)], final: true, skipped: false, at }).status, 'ok');
  assert.equal(describeFlash({ attempts: [], final: true, skipped: true, at }).status, 'unknown');
  assert.equal(describeFlash({ attempts: [attempt('failed', 0.1)], final: false, skipped: false, at }).status, 'unknown');
  assert.equal(describeFlash({ attempts: [attempt('inconclusive', 0.4)], final: true, skipped: false, at }).status, 'unknown');
});
