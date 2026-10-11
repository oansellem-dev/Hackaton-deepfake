// Contrôles de bout en bout sur l'API du serveur (lancé avec KYC_DATA_DIR=<dossier>, agent Python démarré).
// Usage : node server.mjs <dossier de données>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API ?? 'http://localhost:8787';
const DATA = process.argv[2];
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) failures++; };
const sig = (view, id) => view.signals.find((s) => s.id === id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Le recruteur : son jeton est remis à la création de l'entretien. Le candidat : seulement le jeton de son lien.
const keys = new Map();
const links = new Map();
async function send(method, path, body, headers = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}
async function create(extra = {}) {
  const { json } = await send('POST', '/api/sessions', { candidateLabel: 'x', ...extra });
  keys.set(json.id, json.recruiterKey);
  links.set(json.id, json.candidateLink?.token);
  return json;
}
const rec = (id) => ({ 'X-Recruiter-Key': keys.get(id) });
const get = async (id) => (await send('GET', `/api/sessions/${id}`, undefined, rec(id))).json;
const rpost = (id, path, body) => send('POST', `/api/sessions/${id}${path}`, body, rec(id));
const cand = (id, path, body) => send(body === undefined && path === '' ? 'GET' : 'POST', `/api/check/${links.get(id)}${path}`, body);

const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const E = unit(Array.from({ length: 128 }, (_, i) => Math.sin(i + 1)));
const nearE = unit(E.map((x, i) => x + 0.05 * Math.cos(3 * i)));
const otherE = unit(Array.from({ length: 128 }, (_, i) => Math.cos(7 * i + 2)));
const base = [1.2, 1.3, 0.6, 0.9, 0.35, 0.8, 0.55, 0.3];
const angles = [{ yawDeg: -26, ratios: base.map((x) => x * 1.03), samples: 6 }, { yawDeg: 27, ratios: base.map((x) => x * 0.97), samples: 5 }];

async function faceId(id, embedding = E) {
  const plan = (await cand(id, '/faceid/start', { cameraLabel: 'Integrated Camera', biometricConsent: true })).json;
  const results = plan.steps.map((step) => ({ step, result: 'passed', durationMs: 1500 }));
  return { plan, sub: await cand(id, '/faceid/submit', { nonce: plan.nonce, results, ratios: base, samples: 16, angles, embedding, passive: [0.2, 0.3] }) };
}

// Petit PDF texte (une page, Helvetica), pour tester la lecture du CV.
function makePdf(lines) {
  const BS = String.fromCharCode(92); // barre oblique inverse
  const esc = (t) => t.split(BS).join(BS + BS).split('(').join(BS + '(').split(')').join(BS + ')');
  const stream = 'BT /F1 11 Tf 50 800 Td 14 TL ' + lines.map((l) => `(${esc(l)}) Tj T*`).join(' ') + ' ET';
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---------- D2, D1 : jetons, liens, accès
const s1 = await create({ controllerName: 'ESN Exemple', controllerContact: 'dpo@exemple.fr' });
const id = s1.id;
ok(s1.recruiterKey?.length > 20 && s1.candidateLink?.token?.length >= 32, 'jeton recruteur et jeton de lien non devinables (32 caractères)');
ok(s1.candidateLink.expiresAt > Date.now(), 'le lien candidat a une date d’expiration');
ok((await send('GET', `/api/sessions/${id}`)).status === 403, 'sans jeton recruteur : fiche illisible');
ok((await send('GET', `/api/check/${'x'.repeat(32)}`)).status === 404, 'lien inventé : refusé');
const info = (await cand(id, '')).json;
ok(info.status === 'open' && info.controller?.name === 'ESN Exemple', 'le candidat voit le responsable du traitement');
ok(!('signals' in info) && !('score' in info), 'le candidat ne voit ni les signaux ni le score');
const headers = (await fetch(`${API}/api/health`)).headers;
ok(headers.get('referrer-policy') === 'no-referrer' && headers.get('x-content-type-options') === 'nosniff', 'en-têtes de sécurité (pas de fuite de jeton par le Referer)');

// ---------- A1 : aucune image du visage n'est acceptée
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
ok((await fetch(`${API}/api/sessions/${id}/frame`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', ...rec(id) }, body: jpeg })).status === 404, 'aucune route pour envoyer une image');
ok((await fetch(`${API}/api/sessions/${id}/live-sample`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', ...rec(id) }, body: jpeg })).status === 415, 'mesures en direct : image refusée (415)');

// ---------- C : consentement
ok((await cand(id, '/identity', { firstName: 'Ada', lastName: 'Lovelace', consent: false })).status === 400, 'refus sans accord pour les informations');
ok((await cand(id, '/faceid/start', { cameraLabel: 'Integrated Camera', biometricConsent: true })).status === 409, 'caméra refusée avant les informations');
await cand(id, '/identity', { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org', phone: '+33 6 12 34 56 78', country: 'FR', city: 'Paris', company: 'Analytical Engines', consent: true });
ok((await cand(id, '/faceid/start', { cameraLabel: 'Integrated Camera' })).status === 400, 'refus sans consentement biométrique explicite');
let v = await get(id);
ok(sig(v, 'identity.web-presence')?.status === 'ok' && sig(v, 'identity.phone')?.status === 'ok', 'informations vérifiées (sources publiques, indicatif)');

// ---------- CV chargé par le recruteur
const cvPdf = makePdf(['Ada LOVELACE', 'ada.l@autre-domaine.fr | +33 6 12 34 56 78', 'Eugenia School - Bachelor AI 2025', 'Analytical Engines - Developpeuse 2024']);
const cvRes = await fetch(`${API}/api/sessions/${id}/cv`, { method: 'POST', headers: { 'Content-Type': 'application/pdf', ...rec(id) }, body: cvPdf });
const cvView = await cvRes.json();
ok(cvRes.status === 200 && sig(cvView, 'cv.email')?.status === 'contradiction' && cvView.cv?.links?.length > 5, 'CV : écart d’e-mail signalé, liens de vérification');

// ---------- Face ID, gabarit séparé, usage unique
ok((await cand(id, '/faceid/start', { cameraLabel: 'OBS Virtual Camera', biometricConsent: true })).json.error === 'camera-virtuelle', 'caméra virtuelle refusée');
const { plan, sub } = await faceId(id);
ok(sub.json.profileStored === true, 'gabarit créé (empreinte calculée par le navigateur)');
ok((await cand(id, '/identity', { firstName: 'Ada', lastName: 'Lovelace', consent: true })).status === 410, 'lien à usage unique : refusé après utilisation');
ok((await cand(id, '')).json.status === 'used', 'lien marqué « utilisé »');
v = await get(id);
ok(v.consent?.biometricAt && v.consent?.version, 'consentement biométrique horodaté avec la version du texte');
ok(v.hasFaceProfile && !('templateId' in v) && !('faceProfile' in v), 'le gabarit ne sort jamais du serveur');
await wait(700);
const templatesRaw = readFileSync(join(DATA, 'templates.json'), 'utf8');
const sessionsRaw = readFileSync(join(DATA, 'sessions.json'), 'utf8');
ok(!/Lovelace|ada@|Ada/.test(templatesRaw) && !templatesRaw.includes('"ratios"') && templatesRaw.includes('"sealed"'), 'gabarits : chiffrés, sans nom, e-mail ni identifiant d’entretien');
ok(!templatesRaw.includes(`"${id}"`), 'gabarits : aucun lien direct avec l’entretien dans leur fichier');
ok(!sessionsRaw.includes('"ratios"') && !sessionsRaw.includes('"embedding"') && !sessionsRaw.includes('faceProfileSealed'), 'fiches d’entretien : aucune donnée biométrique');

// ---------- Comparaison pendant la visio (mesures du navigateur)
ok((await send('POST', `/api/sessions/${id}/live-sample`, { fakeProbability: 0.1 })).status === 403, 'mesures en direct : réservées au recruteur');
for (let i = 0; i < 5; i++) await rpost(id, '/live-sample', { ratios: base.map((x) => x * 1.01), yawDeg: 3, embedding: nearE, fakeProbability: 0.2 });
v = await get(id);
ok(sig(v, 'face.continuity')?.status === 'ok', `même personne : ${sig(v, 'face.continuity')?.detail}`);
const id2 = (await create()).id;
await cand(id2, '/identity', { firstName: 'Bob', lastName: 'Martin', consent: true });
await faceId(id2);
for (let i = 0; i < 5; i++) await rpost(id2, '/live-sample', { ratios: base.map((x) => x * 1.02), yawDeg: 2, embedding: otherE });
ok(sig(await get(id2), 'face.continuity')?.status === 'contradiction', 'autre personne : visage différent signalé');

// ---------- B3 : suppression manuelle, retrait, décision
const del = await send('DELETE', `/api/sessions/${id2}/biometrics`, undefined, rec(id2));
ok(del.status === 200 && del.json.hasFaceProfile === false, 'suppression manuelle par le recruteur');
ok((await send('DELETE', `/api/sessions/${id2}/biometrics`)).status === 403, 'suppression manuelle : réservée au recruteur');
const w = await cand(id, '/withdraw', {});
v = await get(id);
ok(w.status === 200 && !v.hasFaceProfile && v.consent?.withdrawnAt && sig(v, 'face.withdrawn'), 'retrait du consentement (même après utilisation du lien) : gabarit supprimé');
for (let i = 0; i < 3; i++) await rpost(id, '/live-sample', { embedding: otherE, ratios: base, yawDeg: 0 });
v = await get(id);
ok(sig(v, 'face.continuity')?.status !== 'contradiction', 'après retrait : plus aucune comparaison');

// ---------- C2 : alternative sans biométrie, sans pénalité
const id3 = (await create()).id;
await cand(id3, '/identity', { firstName: 'Zorglub', lastName: 'Kwyxtrandel', consent: true });
ok((await cand(id3, '/optout', {})).status === 200, 'vérification sans biométrie choisie');
v = await get(id3);
ok(!v.hasFaceProfile && sig(v, 'face.optout')?.status === 'unknown' && v.score.level === 'green', 'sans biométrie : aucun gabarit, aucune pénalité');
ok((await cand(id3, '/faceid/start', { cameraLabel: 'Integrated Camera', biometricConsent: true })).status === 410, 'sans biométrie : le lien ne peut plus lancer la caméra');

// ---------- E1 : confirmation d'appareil sans appareil associé
ok((await rpost(id3, '/presence', {})).status === 409, 'confirmation d’appareil : refusée sans appareil associé');

// ---------- Décision : clôture et suppression
const id4 = (await create()).id;
await cand(id4, '/identity', { firstName: 'Eve', lastName: 'Dupont', consent: true });
await faceId(id4);
v = (await rpost(id4, '/decision', { value: 'poursuivre' })).json;
ok(v.hasFaceProfile === false, 'décision du recruteur : gabarit supprimé');

// ---------- F1 : journal d'audit sans donnée biométrique
v = await get(id4);
const actions = (v.audit ?? []).map((a) => a.action);
ok(['Entretien créé', 'Consentement biométrique donné', 'Gabarit biométrique créé', 'Décision', 'Gabarit biométrique supprimé'].every((a) => actions.includes(a)), `journal : ${actions.join(' → ')}`);
await wait(300);
const auditRaw = readFileSync(join(DATA, 'audit.jsonl'), 'utf8');
const longNumberList = /\[(?:-?\d+(?:\.\d+)?,){8,}/;
ok(!auditRaw.includes('embedding') && !auditRaw.includes('"ratios"') && !longNumberList.test(auditRaw), 'journal : aucune empreinte ni proportion');
ok(auditRaw.includes('suppression manuelle') && auditRaw.includes('retrait du consentement') && auditRaw.includes('décision du recruteur'), 'journal : chaque suppression est tracée avec sa raison');

console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
