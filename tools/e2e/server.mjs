// Contrôles de bout en bout sur l'API du serveur (lancé avec KYC_DATA_DIR=<dossier>, agent Python démarré).
// Usage : node server.mjs <dossier de données>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API ?? 'http://localhost:8787';
const DATA = process.argv[2];
const post = async (path, body) => {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const get = async (path) => (await fetch(API + path)).json();
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) failures++; };
const sig = (view, id) => view.signals.find((s) => s.id === id);

// --- Session 1 : candidat cohérent
const id = (await post('/api/sessions', { candidateLabel: 'x' })).json.id;
ok((await post(`/api/sessions/${id}/identity`, { firstName: 'Ada', lastName: 'Lovelace', consent: false })).status === 400, 'refus sans consentement');
ok((await post(`/api/sessions/${id}/faceid/start`, { cameraLabel: 'Integrated Camera' })).status === 409, 'caméra refusée avant le consentement');
const t0 = Date.now();
const idt = await post(`/api/sessions/${id}/identity`, {
  firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.org', phone: '+33 6 12 34 56 78', country: 'FR', city: 'Paris',
  jobTitle: 'Développeuse', company: 'Analytical Engines', linkedinUrl: 'https://www.linkedin.com/in/ada', consent: true,
});
ok(idt.status === 200, `informations enregistrées (${Date.now() - t0} ms, sources publiques interrogées)`);
let v = await get(`/api/sessions/${id}`);
ok(sig(v, 'identity.web-presence')?.status === 'ok', `présence publique : ${sig(v, 'identity.web-presence')?.detail}`);
ok(sig(v, 'identity.email')?.status === 'ok', 'e-mail normal');
ok(sig(v, 'identity.phone')?.status === 'ok', 'indicatif +33 cohérent avec FR');
ok(sig(v, 'identity.linkedin')?.status === 'unknown', 'LinkedIn déclaré mais non vérifié (pas de scraping)');
ok(v.candidateLabel === 'Ada Lovelace' && v.identity.city === 'Paris', 'identité visible du recruteur');

ok((await post(`/api/sessions/${id}/faceid/start`, { cameraLabel: 'OBS Virtual Camera' })).json.error === 'camera-virtuelle', 'caméra virtuelle refusée');
v = await get(`/api/sessions/${id}`);
ok(sig(v, 'precheck.virtual-camera')?.status === 'contradiction', 'tentative avec caméra virtuelle tracée');

// Session 1 bis, sans la tentative OBS, pour le parcours normal
const id1 = (await post('/api/sessions', {})).json.id;
await post(`/api/sessions/${id1}/identity`, { firstName: 'Ada', lastName: 'Lovelace', country: 'FR', consent: true });
await post(`/api/sessions/${id1}/precheck`, { cameras: ['Integrated Camera'], timezone: 'Europe/Paris', languages: ['fr'], declaredCountry: 'FR' });
const start = (await post(`/api/sessions/${id1}/faceid/start`, { cameraLabel: 'Integrated Camera' })).json;
ok(start.steps?.[0] === 'center' && start.steps.length === 4 && !start.hardened, `parcours normal : ${start.steps?.join(', ')}`);

const base = [1.2, 1.3, 0.6, 0.9, 0.35, 0.8, 0.55, 0.3];
const right = base.map((x) => x * 1.03);
const angles = [{ yawDeg: -26, ratios: right, samples: 6 }, { yawDeg: 27, ratios: base.map((x) => x * 0.97), samples: 5 }];
const results = start.steps.map((step) => ({ step, result: 'passed', durationMs: 1500 }));
ok((await post(`/api/sessions/${id1}/faceid/submit`, { nonce: 'faux', results, ratios: base, samples: 16 })).status === 409, 'mauvais nonce refusé');
const sub = await post(`/api/sessions/${id1}/faceid/submit`, { nonce: start.nonce, results, ratios: base, samples: 16, angles });
ok(sub.json.profileStored === true, 'profil enregistré (face + 2 angles)');
ok((await post(`/api/sessions/${id1}/faceid/start`, { cameraLabel: 'Integrated Camera' })).status === 409, 'pas de second passage après la fin');
v = await get(`/api/sessions/${id1}`);
ok(!('faceProfile' in v) && v.hasFaceProfile, 'le profil ne sort jamais du serveur');
ok(v.challenges.every((c) => c.phase === 'precheck'), 'défis marqués « pré-vérification »');
ok(v.agent?.recommendations?.[0]?.challengeId === 'hand-over-face', `en direct, l'agent recommande encore la main (${v.agent?.recommendations?.[0]?.challengeId})`);

await new Promise((r) => setTimeout(r, 600));
const raw = readFileSync(join(DATA, 'sessions.json'), 'utf8');
ok(raw.includes('faceProfileSealed') && !raw.includes('"ratios"'), 'profil chiffré sur disque');

for (let i = 0; i < 3; i++) await post(`/api/sessions/${id1}/face-sample`, { ratios: base.map((x) => x * 1.01), yawDeg: 3 });
for (let i = 0; i < 3; i++) await post(`/api/sessions/${id1}/face-sample`, { ratios: right, yawDeg: -24 });
ok((await post(`/api/sessions/${id1}/face-sample`, { ratios: base, yawDeg: 55 })).json.reason === 'angle sans profil de référence', 'angle sans profil ignoré');
v = await get(`/api/sessions/${id1}`);
ok(sig(v, 'face.continuity')?.status === 'ok', `même visage, de face et tourné : ${sig(v, 'face.continuity')?.detail}`);

// --- Session 2 : informations incohérentes → parcours durci, visage différent pendant l'entretien
const id2 = (await post('/api/sessions', {})).json.id;
await post(`/api/sessions/${id2}/identity`, {
  firstName: 'Zorglub', lastName: 'Kwyxtrandel', email: 'zk@yopmail.com', phone: '+44 7700 900123', country: 'FR',
  githubUrl: 'https://github.com/torvalds', consent: true,
});
v = await get(`/api/sessions/${id2}`);
ok(sig(v, 'identity.web-presence')?.status === 'unknown', 'nom introuvable = inconnu, sans effet sur le score');
ok(sig(v, 'identity.email')?.status === 'contradiction', 'e-mail jetable signalé');
ok(sig(v, 'identity.phone')?.status === 'contradiction', 'indicatif +44 pour la France signalé');
ok(sig(v, 'identity.github')?.status === 'contradiction', `GitHub : ${sig(v, 'identity.github')?.detail}`);
const st2 = (await post(`/api/sessions/${id2}/faceid/start`, { cameraLabel: 'Integrated Camera' })).json;
ok(st2.hardened && st2.steps.length === 7, `parcours renforcé (${st2.steps.length} étapes)`);
await post(`/api/sessions/${id2}/faceid/submit`, { nonce: st2.nonce, results: st2.steps.map((step) => ({ step, result: 'passed', durationMs: 1 })), ratios: base, samples: 16 });
const other = base.map((x, i) => x * (i % 2 ? 1.25 : 0.8));
for (let i = 0; i < 6; i++) await post(`/api/sessions/${id2}/face-sample`, { ratios: other, yawDeg: 2 });
v = await get(`/api/sessions/${id2}`);
ok(sig(v, 'face.continuity')?.status === 'contradiction', 'visage différent détecté');
console.log(`     score session 2 : ${v.score.value} (${v.score.level})`);

// --- Absence de trace : ne pénalise jamais
const id3 = (await post('/api/sessions', {})).json.id;
await post(`/api/sessions/${id3}/identity`, { firstName: 'Zorglub', lastName: 'Kwyxtrandel', consent: true });
v = await get(`/api/sessions/${id3}`);
ok(v.signals.every((s) => s.status !== 'contradiction'), 'rien de déclaré, rien trouvé : aucune contradiction');

// --- Décision = effacement
await post(`/api/sessions/${id1}/decision`, { value: 'continue' });
ok((await get(`/api/sessions/${id1}`)).hasFaceProfile === false, 'profil effacé à la décision');
await new Promise((r) => setTimeout(r, 600));
ok(!JSON.parse(readFileSync(join(DATA, 'sessions.json'), 'utf8')).find((x) => x.id === id1).faceProfileSealed, 'effacé aussi sur disque');

console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
