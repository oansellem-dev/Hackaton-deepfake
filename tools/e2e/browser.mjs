// Test de bout en bout dans un vrai Chrome (profil temporaire, sans interface), caméra simulée par une vidéo.
// Usage : node browser.mjs <candidat.y4m> <autre.y4m> <dossier captures> [precheck|visio|all|live [fige.y4m]]
// playwright-core pilote le Chrome installé (CHROME_PATH), sans télécharger de navigateur.
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE ?? 'http://localhost:8787';
const [candidateVideo, otherVideo, shots, mode = 'all'] = process.argv.slice(2);
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) failures++; };
const keys = new Map(); // jetons recruteur, reçus à la création des entretiens
const api = async (path, body) => {
  const headers = { 'Content-Type': 'application/json', 'X-Recruiter-Key': keys.get(path.split('/')[3]) ?? '' };
  const r = await fetch(BASE + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  const json = await r.json();
  if (path === '/api/sessions' && json.recruiterKey) keys.set(json.id, json.recruiterKey);
  return json;
};

function launch(video) {
  return chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${video}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
}

async function newPage(browser, tag) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${tag}] erreur page :`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${tag}] console :`, m.text().slice(0, 200)); });
  return page;
}

async function precheck(browser, id, who) {
  const page = await newPage(browser, 'candidat');
  await page.goto(`${BASE}/check/${id}`);
  await page.fill('input[autocomplete="given-name"]', who.first);
  await page.fill('input[autocomplete="family-name"]', who.last);
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="tel"]', who.phone);
  await page.check('.consent input');
  await page.screenshot({ path: `${shots}/1-informations.png`, fullPage: true });
  await page.click('button[type="submit"]');
  await page.click('text=Activer la caméra et commencer', { timeout: 30000 });

  const t0 = Date.now();
  let last = '';
  let shot = false;
  while (Date.now() - t0 < 180000) {
    if (await page.locator('text=Merci, c’est terminé').count()) break;
    const err = await page.locator('.faceid-error').allTextContents();
    if (err.length) { console.log('     erreur affichée :', err.join(' ')); break; }
    const state = await page.evaluate(() => {
      const q = (s) => document.querySelector(s)?.textContent ?? '';
      const steps = [...document.querySelectorAll('.faceid-steps li')].map((li) => `${li.textContent}:${li.className || '-'}`);
      return `${q('.faceid-instruction')} | ${q('.faceid-hint')} | ${steps.join(', ')}`;
    });
    if (state !== last) { console.log(`     ${((Date.now() - t0) / 1000).toFixed(1)} s  ${state}`); last = state; }
    if (state.includes('faceid-current') && !shot) {
      shot = true;
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${shots}/2-visage.png` }).catch(() => {});
    }
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${shots}/3-fin-${id}.png`, fullPage: true });
  const done = (await page.locator('text=Merci, c’est terminé').count()) > 0;
  ok(done, `pré-vérification terminée en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.context().close();
  return done;
}

async function visio(candidateBrowser, recruiterBrowser, id, seconds) {
  const cand = await newPage(candidateBrowser, 'visio-candidat');
  const rec = await newPage(recruiterBrowser, 'visio-recruteur');
  await cand.goto(`${BASE}/visio/${id}?role=candidate`);
  await rec.goto(`${BASE}/visio/${id}?role=recruiter&key=${keys.get(id)}`);
  await rec.waitForSelector('text=Connecté', { timeout: 30000 }).catch(() => console.log('     pas de connexion WebRTC'));
  await rec.waitForTimeout(seconds * 1000);
  await rec.screenshot({ path: `${shots}/4-visio-${id}.png` });
  await cand.context().close();
  await rec.context().close();
}

const sig = (v, id) => v.signals.find((s) => s.id === id);

// Défis en direct : le recruteur clique sur « J'ai proposé : … » trois fois de suite (défi recommandé par l'agent).
async function liveChallenges(candidateBrowser, recruiterBrowser, id, tag) {
  const cand = await newPage(candidateBrowser, 'visio-candidat');
  const rec = await newPage(recruiterBrowser, 'visio-recruteur');
  await cand.goto(`${BASE}/visio/${id}?role=candidate`);
  await rec.goto(`${BASE}/visio/${id}?role=recruiter&key=${keys.get(id)}`);
  await rec.waitForSelector('text=Connecté', { timeout: 30000 });
  await rec.waitForTimeout(4000);
  const results = [];
  for (let i = 0; i < 3; i++) {
    const btn = rec.locator('.kyc-actions button').first();
    const label = (await btn.textContent())?.replace("J'ai proposé : ", '');
    const t0 = Date.now();
    await btn.click();
    await rec.waitForFunction(() => !document.querySelector('.kyc-actions button')?.textContent?.includes('Analyse en cours'), null, { timeout: 40000 });
    const v = await api(`/api/sessions/${id}`);
    const last = v.challenges.filter((c) => c.phase !== 'precheck').at(-1);
    console.log(`     ${label} → ${last?.result} en ${((Date.now() - t0) / 1000).toFixed(1)} s ${JSON.stringify(last?.metrics)}`);
    results.push({ id: last?.challengeId, result: last?.result });
    await rec.waitForTimeout(2500);
  }
  await rec.screenshot({ path: `${shots}/6-defis-${tag}.png` });
  await cand.context().close();
  await rec.context().close();
  return results;
}
const candidateBrowser = await launch(candidateVideo);
const recruiterBrowser = await launch(candidateVideo);

if (mode === 'precheck' || mode === 'all') {
  const id = (await api('/api/sessions', { candidateLabel: 'Test navigateur' })).id;
  console.log(`--- Pré-vérification (session ${id})`);
  await precheck(candidateBrowser, id, { first: 'Eileen', last: 'Collins', email: 'eileen@example.org', phone: '+33 6 12 34 56 78' });
  await new Promise((r) => setTimeout(r, 2000));
  const v = await api(`/api/sessions/${id}`);
  console.log('     défis :', v.challenges.map((c) => `${c.challengeId}=${c.result}`).join(', '));
  console.log('     détecteur passif :', JSON.stringify(v.agent?.passive), '| profil :', JSON.stringify(v.faceProfileSummary));
  ok(v.hasFaceProfile, 'profil du visage enregistré');
  ok(sig(v, 'face.profile')?.status === 'ok', `profil : ${sig(v, 'face.profile')?.detail}`);
  ok(v.challenges.length >= 3, 'défis de la pré-vérification enregistrés');

  if (mode === 'all') {
    console.log('--- Visio, même personne');
    await visio(candidateBrowser, recruiterBrowser, id, 28);
    const v2 = await api(`/api/sessions/${id}`);
    const c = sig(v2, 'face.continuity');
    ok(c?.status === 'ok', `continuité : ${c?.label} — ${c?.detail}`);
    console.log(`     score : ${v2.score.value} (${v2.score.level})`);
  }
}

if (mode === 'visio' || mode === 'all') {
  const id = (await api('/api/sessions', { candidateLabel: 'Substitution' })).id;
  console.log(`--- Substitution : pré-vérification par une personne, visio par une autre (session ${id})`);
  await precheck(candidateBrowser, id, { first: 'Eileen', last: 'Collins', email: 'eileen@example.org', phone: '+33 6 12 34 56 78' });
  const otherBrowser = await launch(otherVideo);
  await visio(otherBrowser, recruiterBrowser, id, 28);
  const v = await api(`/api/sessions/${id}`);
  const c = sig(v, 'face.continuity');
  ok(c?.status === 'contradiction', `continuité : ${c?.label} — ${c?.detail}`);
  console.log(`     score : ${v.score.value} (${v.score.level})`);
  await otherBrowser.close();
}

if (mode === 'live') {
  const staticVideo = process.argv[6];
  const id = (await api('/api/sessions', { candidateLabel: 'Défis en direct' })).id;
  console.log(`--- Défis en direct, candidat qui fait les gestes (session ${id})`);
  const r = await liveChallenges(candidateBrowser, recruiterBrowser, id, 'gestes');
  ok(r.find((x) => x.id === 'hand-over-face')?.result === 'passed', 'main devant le visage : réussi');
  ok(r.find((x) => x.id === 'head-turn')?.result === 'passed', 'rotation de la tête : réussi');
  ok(r.find((x) => x.id === 'random-phrase')?.result === 'inconclusive', 'phrase (photo, lèvres immobiles) : non concluant, sans pénalité');
  let v = await api(`/api/sessions/${id}`);
  console.log(`     score : ${v.score.value} (${v.score.level})`);
  ok(v.score.level === 'green', 'candidat qui fait les gestes : vert');

  if (staticVideo) {
    const id2 = (await api('/api/sessions', { candidateLabel: 'Image figée' })).id;
    console.log(`--- Défis en direct, image figée qui ne bouge pas (session ${id2})`);
    const frozen = await launch(staticVideo);
    const r2 = await liveChallenges(frozen, recruiterBrowser, id2, 'fige');
    ok(r2.find((x) => x.id === 'hand-over-face')?.result === 'failed', 'main devant le visage : non exécuté');
    ok(r2.find((x) => x.id === 'head-turn')?.result === 'failed', 'rotation de la tête : non exécutée');
    v = await api(`/api/sessions/${id2}`);
    console.log(`     score : ${v.score.value} (${v.score.level}) — ${v.score.explanation.join(' / ')}`);
    ok(v.score.level === 'red', 'image figée : rouge');
    await frozen.close();
  }
}

await candidateBrowser.close();
await recruiterBrowser.close();
console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
