// Test de bout en bout du test du reflet de l'écran, dans un vrai Chrome sans interface.
// Usage : node flash.mjs <photo de visage.jpg>   (site construit, serveur lancé ; BASE, CHROME_PATH)
//   1. Espace de test : photo qui renvoie la couleur de l'écran → « Réussi » ; photo qui ne réagit pas → « Échec ».
//   2. Pré-vérification avec une fausse caméra (photo fixe) : deux essais sans reflet → signal à vérifier.
//   3. « Passer ce test » → signal sans effet sur le score ; règles du serveur (ordre, essais, validation).
// playwright-core pilote le Chrome installé, sans télécharger de navigateur.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const BASE = process.env.BASE ?? 'http://localhost:8787';
const [photo] = process.argv.slice(2);
if (!photo) throw new Error('Usage : node flash.mjs <photo de visage.jpg>');

let failures = 0;
const ok = (cond, msg) => {
  console.log(cond ? 'OK  ' : 'FAIL', msg);
  if (!cond) failures++;
};
const api = async (path, body) => {
  const r = await fetch(BASE + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  return { status: r.status, body: await r.json() };
};

// Fausse caméra : la photo répétée en MJPEG, donc une image parfaitement fixe (comme une vidéo injectée immobile).
const dir = mkdtempSync(join(tmpdir(), 'kyc-flash-'));
const mjpeg = join(dir, 'visage.mjpeg');
writeFileSync(mjpeg, Buffer.concat(Array.from({ length: 30 }, () => readFileSync(photo))));

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-video-capture=${mjpeg}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});

async function newPage(tag) {
  const ctx = await browser.newContext({ permissions: ['camera'], viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`     [${tag}] erreur page :`, e.message));
  page.on('console', (m) => m.type() === 'error' && console.log(`     [${tag}] console :`, m.text().slice(0, 200)));
  return page;
}

// --- 1. Espace de test, caméras simulées ---
async function labRun(kind) {
  const page = await newPage(`lab ${kind}`);
  await page.goto(`${BASE}/lab/flash`);
  await page.selectOption('select', kind);
  await page.setInputFiles('input[type="file"][accept="image/*"]', photo);
  await page.waitForTimeout(1500); // la simulation démarre
  const t0 = Date.now();
  await page.click('text=Lancer l’essai');
  await page.waitForSelector('.lab-verdict', { timeout: 60000 });
  const verdict = await page.textContent('.lab-verdict');
  const facts = (await page.locator('.facts').first().innerText()).replace(/\s+/g, ' ');
  console.log(`     ${kind} en ${((Date.now() - t0) / 1000).toFixed(1)} s : ${verdict} · ${facts.slice(0, 260)}`);
  await page.context().close();
  return verdict;
}

console.log('--- Espace de test (/lab/flash)');
ok((await labRun('sim-react')) === 'Réussi', 'photo qui renvoie la couleur de l’écran → Réussi');
ok((await labRun('sim-static')) === 'Échec', 'photo qui ne réagit pas → Échec');

// --- 2 et 3. Pré-vérification ---
async function sessionAtFlashStep(label) {
  const { body: s } = await api('/api/sessions', { candidateLabel: label });
  await api(`/api/sessions/${s.id}/identity`, { firstName: 'Test', lastName: 'Reflet', country: 'FR', consent: true });
  const { body: plan } = await api(`/api/sessions/${s.id}/faceid/start`, { cameraLabel: 'FaceTime HD Camera' });
  const submit = await api(`/api/sessions/${s.id}/faceid/submit`, {
    nonce: plan.nonce,
    results: plan.steps.map((step) => ({ step, result: 'passed', durationMs: 1000 })),
    ratios: [],
    samples: 0,
    angles: [],
  });
  if (submit.status !== 200) throw new Error(`Face ID simulé refusé : ${JSON.stringify(submit.body)}`);
  return s.id;
}

async function openFlashStep(id, tag) {
  const page = await newPage(tag);
  // La page reprend à l'étape enregistrée : on arrive directement au test du reflet.
  await page.addInitScript((sid) => sessionStorage.setItem(`kyc-precheck-${sid}`, JSON.stringify({ step: 'flash', country: 'FR' })), id);
  await page.goto(`${BASE}/check/${id}`);
  await page.waitForSelector('text=Test du reflet de l’écran');
  return page;
}

const signal = (v, id) => v.signals.find((s) => s.id === id);

console.log('--- Pré-vérification, fausse caméra fixe');
{
  const id = await sessionAtFlashStep('Reflet fixe');
  const page = await openFlashStep(id, 'candidat');
  const t0 = Date.now();
  await page.click('text=Commencer le test du reflet');
  await page.waitForSelector('text=Réessayer le test', { timeout: 60000 });
  ok(true, `1er essai terminé en ${((Date.now() - t0) / 1000).toFixed(1)} s, second essai proposé`);
  const mid = (await api(`/api/sessions/${id}`)).body;
  ok(signal(mid, 'precheck.screen-flash')?.status === 'unknown', 'après un seul essai : signal sans effet (test non terminé)');
  await page.click('text=Réessayer le test');
  await page.waitForSelector('text=Merci, c’est terminé', { timeout: 60000 });
  const v = (await api(`/api/sessions/${id}`)).body;
  const s = signal(v, 'precheck.screen-flash');
  ok(v.screenFlash?.final && v.screenFlash.attempts.length === 2, `2 essais enregistrés : ${v.screenFlash?.attempts.map((a) => `${a.result} (accord ${a.correlation}, ${a.fps} i/s, visage ${a.faceCoverage})`).join(' ; ')}`);
  ok(s?.status === 'contradiction', `signal : ${s?.label} — ${s?.detail}`);
  ok(!JSON.stringify(v.screenFlash).includes('rgb'), 'aucune mesure image par image envoyée au serveur');
  await page.goto(`${BASE}/report/${id}`);
  await page.waitForSelector('text=test du reflet de l’écran');
  ok((await page.content()).includes('aucune réaction de l’image (2 essais)'), 'rapport : « aucune réaction de l’image (2 essais) »');
  await page.context().close();

  const again = await api(`/api/sessions/${id}/flash`, { attempt: v.screenFlash.attempts[0], final: true });
  ok(again.status === 409, 'un test terminé ne peut pas être rejoué');
}

console.log('--- Pré-vérification, « Passer ce test »');
{
  const id = await sessionAtFlashStep('Reflet passé');
  const page = await openFlashStep(id, 'candidat passe');
  await page.click('text=Passer ce test');
  await page.waitForSelector('text=Merci, c’est terminé', { timeout: 20000 });
  const v = (await api(`/api/sessions/${id}`)).body;
  ok(v.screenFlash?.skipped && signal(v, 'precheck.screen-flash')?.status === 'unknown', 'passé : signal sans effet sur le score');
  await page.context().close();
}

console.log('--- Règles du serveur');
{
  const { body: s } = await api('/api/sessions', { candidateLabel: 'Ordre' });
  await api(`/api/sessions/${s.id}/identity`, { firstName: 'Test', lastName: 'Ordre', consent: true });
  ok((await api(`/api/sessions/${s.id}/flash`, { skipped: true, final: true })).status === 409, 'refusé avant la vérification du visage');

  const id = await sessionAtFlashStep('Validation');
  ok((await api(`/api/sessions/${id}/flash`, { attempt: { result: 'passed', correlation: 7 }, final: true })).status === 400, 'essai invalide refusé');
  const attempt = { result: 'failed', reason: 'no-response', correlation: 0.1, pValue: 0.5, lagMs: 100, amplitude: 0.01, frames: 200, fps: 30, faceCoverage: 1 };
  ok((await api(`/api/sessions/${id}/flash`, { attempt, final: false })).status === 200, '1er essai accepté');
  ok((await api(`/api/sessions/${id}/flash`, { skipped: true, final: true })).status === 409, '« passer » refusé après un essai');
  const second = await api(`/api/sessions/${id}/flash`, { attempt, final: false });
  ok(second.status === 200 && second.body.final === true, '2e essai : test terminé d’office');
  ok((await api(`/api/sessions/${id}/flash`, { attempt, final: true })).status === 409, '3e essai refusé');
}

await browser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
