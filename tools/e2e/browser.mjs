// Test de bout en bout dans un vrai Chrome (profil temporaire, sans interface), caméra simulée par une vidéo.
// Usage : node browser.mjs <candidat.y4m> <autre.y4m> <dossier captures> [precheck|visio|all|live [fige.y4m]|teams <teams.y4m> <teams-autre.y4m>]
// playwright-core pilote le Chrome installé (CHROME_PATH), sans télécharger de navigateur.
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE ?? 'http://localhost:8787';
const [candidateVideo, otherVideo, shots, mode = 'all'] = process.argv.slice(2);
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) failures++; };
const keys = new Map(); // jetons recruteur, reçus à la création des entretiens
const links = new Map(); // jetons des liens de pré-vérification (/check/<jeton>)
const api = async (path, body) => {
  const headers = { 'Content-Type': 'application/json', 'X-Recruiter-Key': keys.get(path.split('/')[3]) ?? '' };
  const r = await fetch(BASE + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  const json = await r.json();
  if (path === '/api/sessions' && json.recruiterKey) {
    keys.set(json.id, json.recruiterKey);
    links.set(json.id, json.candidateLink.token);
  }
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

// Exigence « aucune photo côté serveur » : toute requête qui envoie une image au serveur fait échouer le test.
const imageUploads = [];

async function newPage(browser, tag) {
  const ctx = await browser.newContext({ permissions: ['camera', 'microphone'], viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  page.on('request', (r) => {
    if (!r.url().startsWith(BASE) || r.method() !== 'POST') return;
    const type = r.headers()['content-type'] ?? '';
    if (type.startsWith('image/') || type.startsWith('multipart/') || r.url().includes('/frame')) imageUploads.push(`${tag} ${r.url()}`);
  });
  page.on('pageerror', (e) => console.log(`[${tag}] erreur page :`, e.message));
  page.on('response', (r) => { if (r.url().includes('/device') || r.url().includes('/presence')) console.log(`     [${tag}] ${r.request().method()} ${new URL(r.url()).pathname.replace(/[A-Za-z0-9_-]{24,}/, '…')} → ${r.status()}`); });
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${tag}] console :`, m.text().slice(0, 200)); });
  return page;
}

async function precheck(browser, id, who, withPasskey = false) {
  const page = await newPage(browser, 'candidat');
  if (withPasskey) {
    // Authentificateur virtuel de Chrome : la clé d'accès est réellement créée puis présentée, sans matériel.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
    });
  }
  await page.goto(`${BASE}/check/${links.get(id)}`);
  await page.fill('input[autocomplete="given-name"]', who.first);
  await page.fill('input[autocomplete="family-name"]', who.last);
  await page.fill('input[type="email"]', who.email);
  await page.fill('input[type="tel"]', who.phone);
  await page.check('.consent input');
  await page.screenshot({ path: `${shots}/1-informations.png`, fullPage: true });
  await page.click('button[type="submit"]');
  // Écran de consentement biométrique : case non cochée, bouton bloqué tant qu'elle ne l'est pas.
  await page.waitForSelector('text=Vérification du visage : votre accord', { timeout: 30000 });
  ok(await page.locator('text=Continuer vers la caméra').isDisabled(), 'caméra bloquée tant que l’accord biométrique n’est pas donné');
  await page.screenshot({ path: `${shots}/1b-consentement.png`, fullPage: true });
  await page.check('.consent input');
  await page.click('text=Continuer vers la caméra');
  await page.click('text=Activer la caméra et commencer', { timeout: 30000 });

  const t0 = Date.now();
  let last = '';
  let shot = false;
  while (Date.now() - t0 < 180000) {
    if (await page.locator('text=Merci, c’est terminé').count()) break;
    // Étape 3 (reflet de l'écran) : passée ici pour garder ce scénario inchangé ; elle a son propre test (flash.mjs).
    if (await page.locator('text=Passer ce test').count()) {
      await page.click('text=Passer ce test');
    if (await page.locator('text=Dernière étape, facultative').count()) {
      await page.click(withPasskey ? 'button:has-text("Associer cet appareil")' : 'button:has-text("Passer")');
      const outcome = await Promise.race([
        page.waitForSelector('text=Merci, c’est terminé', { timeout: 30000 }).then(() => 'fini'),
        page.waitForSelector('.card .faceid-error', { timeout: 30000 }).then(async (e) => `erreur : ${await e.textContent()}`),
      ]).catch(() => 'rien en 30 s');
      if (outcome !== 'fini') {
        console.log(`     association d'appareil : ${outcome}`);
        break;
      }
      continue;
    }
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
  // Avec une clé d'accès, la page reste ouverte : c'est le même « appareil » qui confirmera pendant la visio.
  if (withPasskey) return page;
  await page.context().close();
  return null;
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
  console.log(`--- Pré-vérification avec association d'appareil (session ${id})`);
  const device = await precheck(candidateBrowser, id, { first: 'Eileen', last: 'Collins', email: 'eileen@example.org', phone: '+33 6 12 34 56 78' }, true);
  await new Promise((r) => setTimeout(r, 2000));
  const v = await api(`/api/sessions/${id}`);
  console.log('     défis :', v.challenges.map((c) => `${c.challengeId}=${c.result}`).join(', '));
  console.log('     détecteur passif :', JSON.stringify(v.agent?.passive), '| profil :', JSON.stringify(v.faceProfileSummary));
  ok(v.hasFaceProfile, 'profil du visage enregistré');
  ok(sig(v, 'face.profile')?.status === 'ok', `profil : ${sig(v, 'face.profile')?.detail}`);
  ok(v.challenges.length >= 3, 'défis de la pré-vérification enregistrés');
  ok(v.deviceBound && sig(v, 'device.bound')?.status === 'ok', 'appareil associé (clé d’accès créée par le navigateur)');

  // Pendant la visio, le recruteur demande une confirmation : le candidat ouvre le lien sur le même appareil.
  const { path } = await (await fetch(`${BASE}/api/sessions/${id}/presence`, { method: 'POST', headers: { 'X-Recruiter-Key': keys.get(id) } })).json();
  await device.goto(`${BASE}${path}`);
  await device.click('button:has-text("Confirmer avec ma clé d’accès")');
  await device.waitForSelector('text=c’est confirmé', { timeout: 30000 }).catch(() => undefined);
  const vp = await api(`/api/sessions/${id}`);
  ok(sig(vp, 'device.presence')?.status === 'ok', `confirmation d’appareil : ${sig(vp, 'device.presence')?.label}`);
  ok((await fetch(`${BASE}/api/presence/${path.split('/').pop()}`)).status === 410, 'lien de confirmation à usage unique');
  await device.context().close();

  if (mode === 'all') {
    console.log('--- Visio, même personne');
    await visio(candidateBrowser, recruiterBrowser, id, 40);
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
  await visio(otherBrowser, recruiterBrowser, id, 40);
  const v = await api(`/api/sessions/${id}`);
  const c = sig(v, 'face.continuity');
  ok(c?.status === 'contradiction', `continuité : ${c?.label} — ${c?.detail}`);
  console.log(`     score : ${v.score.value} (${v.score.level})`);
  await otherBrowser.close();
}

// Visio Teams/Meet/Zoom : le recruteur partage la fenêtre de l'appel avec /panel. Le partage d'écran est simulé
// par la fausse caméra (vidéo d'une « fenêtre Teams » : candidat en grand, vignette du recruteur en bas à droite).
async function teamsPanel(video, id, seconds, withChallenge) {
  const browser = await launch(video);
  const page = await newPage(browser, 'panneau-teams');
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => navigator.mediaDevices.getUserMedia({ video: true });
  });
  await page.goto(`${BASE}/panel/${id}?key=${keys.get(id)}`);
  await page.click('text=Partager la fenêtre de la visio');
  let challenge;
  if (withChallenge) {
    await page.waitForTimeout(6000);
    const btn = page.locator('.kyc-actions button').first();
    const label = (await btn.textContent())?.replace("J'ai proposé : ", '');
    await btn.click();
    await page.waitForFunction(() => !document.querySelector('.kyc-actions button')?.textContent?.includes('Analyse en cours'), null, { timeout: 40000 });
    const v = await api(`/api/sessions/${id}`);
    challenge = v.challenges.filter((c) => c.phase !== 'precheck').at(-1);
    console.log(`     défi dans Teams : ${label} → ${challenge?.result} ${JSON.stringify(challenge?.metrics)}`);
  }
  await page.waitForTimeout(seconds * 1000);
  await page.screenshot({ path: `${shots}/8-teams-${id}.png` });
  await browser.close();
  return challenge;
}

if (mode === 'teams') {
  const [teamsSame, teamsOther] = process.argv.slice(6);
  const id = (await api('/api/sessions', { candidateLabel: 'Visio Teams' })).id;
  console.log(`--- Teams : pré-vérification, puis panneau sur la fenêtre partagée (session ${id})`);
  await precheck(candidateBrowser, id, { first: 'Eileen', last: 'Collins', email: 'eileen@example.org', phone: '+33 6 12 34 56 78' });
  const challenge = await teamsPanel(teamsSame, id, 35, true);
  ok(challenge?.result === 'passed', 'défi détecté sur la fenêtre Teams partagée');
  let v = await api(`/api/sessions/${id}`);
  ok(sig(v, 'face.continuity')?.status === 'ok', `continuité dans Teams (grand visage, vignette ignorée) : ${sig(v, 'face.continuity')?.detail}`);
  console.log(`     score : ${v.score.value} (${v.score.level})`);

  const id2 = (await api('/api/sessions', { candidateLabel: 'Substitution Teams' })).id;
  console.log(`--- Teams : substitution (session ${id2})`);
  await precheck(candidateBrowser, id2, { first: 'Eileen', last: 'Collins', email: 'eileen@example.org', phone: '+33 6 12 34 56 78' });
  await teamsPanel(teamsOther, id2, 40, false);
  v = await api(`/api/sessions/${id2}`);
  ok(sig(v, 'face.continuity')?.status === 'contradiction', `substitution dans Teams : ${sig(v, 'face.continuity')?.detail}`);
  console.log(`     score : ${v.score.value} (${v.score.level})`);
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
ok(imageUploads.length === 0, `aucune image envoyée au serveur${imageUploads.length ? ` : ${imageUploads.slice(0, 3).join(', ')}` : ''}`);
console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
