// Durées de vie : expiration du lien et suppression automatique du gabarit (TTL), sur un serveur lancé avec
// des durées très courtes :
//   BIOMETRIC_TTL_SECONDS=3 BIOMETRIC_SWEEP_SECONDS=1 CANDIDATE_LINK_TTL_SECONDS=3 KYC_DATA_DIR=<dossier> PORT=8789
// Usage : node retention.mjs <dossier de données>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const API = process.env.API ?? 'http://localhost:8789';
const DATA = process.argv[2];
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (path, body, headers = {}) => {
  const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body ?? {}) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const unit = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const E = unit(Array.from({ length: 128 }, (_, i) => Math.sin(i + 1)));
const base = [1.2, 1.3, 0.6, 0.9, 0.35, 0.8, 0.55, 0.3];

// Expiration du lien
const a = (await post('/api/sessions', {})).json;
ok((await fetch(`${API}/api/check/${a.candidateLink.token}`)).status === 200, 'lien valable juste après la création');
await wait(3500);
ok((await post(`/api/check/${a.candidateLink.token}/identity`, { firstName: 'A', lastName: 'B', consent: true })).status === 410, 'lien expiré : refusé (410)');
ok((await (await fetch(`${API}/api/check/${a.candidateLink.token}`)).json()).status === 'expired', 'lien marqué « expiré »');

// Suppression automatique du gabarit (TTL)
const b = (await post('/api/sessions', {})).json;
const t = b.candidateLink.token;
await post(`/api/check/${t}/identity`, { firstName: 'Ada', lastName: 'Lovelace', consent: true });
const plan = (await post(`/api/check/${t}/faceid/start`, { cameraLabel: 'Integrated Camera', biometricConsent: true })).json;
const results = plan.steps.map((step) => ({ step, result: 'passed', durationMs: 1 }));
await post(`/api/check/${t}/faceid/submit`, { nonce: plan.nonce, results, ratios: base, samples: 16, embedding: E });
const view = async () => (await fetch(`${API}/api/sessions/${b.id}`, { headers: { 'X-Recruiter-Key': b.recruiterKey } })).json();
ok((await view()).hasFaceProfile === true, 'gabarit présent juste après la vérification');
await wait(5000);
const v = await view();
ok(v.hasFaceProfile === false, 'gabarit supprimé automatiquement à expiration');
ok(v.audit.some((x) => x.action === 'Gabarit biométrique supprimé' && x.detail === 'durée maximale atteinte' && x.actor === 'système'), 'suppression automatique tracée au journal');
const templates = JSON.parse(readFileSync(join(DATA, 'templates.json'), 'utf8'));
ok(templates.length === 0, 'plus aucun gabarit sur disque');

console.log(failures ? `${failures} échec(s)` : 'Tout est OK');
process.exitCode = failures ? 1 : 0;
