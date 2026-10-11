import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { getChallenge, type ChallengeResult, type Decision, type Schedule, type CvAnalysis } from '@kyc/shared';
import { analyzeCv, viewWithAgent, type CvResult } from './agent.ts';
import { audit } from './audit.ts';
import { analyserTexte, comparerCv, extraireTexte } from './cv.ts';
import { recruiterOnly } from './auth.ts';
import { candidateRouter } from './candidate.ts';
import { cleanMetrics, recordChallenge } from './challenges.ts';
import { flashRouter } from './flash.ts';
import { forceHttps } from './config.ts';
import { liveRouter } from './live.ts';
import { attachSignaling } from './signaling.ts';
import { createSession, getSession, purgeBiometrics, schedulePersist, upsertSignals } from './store.ts';
import { presenceRouter } from './webauthn.ts';

const PORT = Number(process.env.PORT ?? 8787);

// Créneau envoyé par le dashboard : seulement des dates plausibles, 12 alternatives au plus.
export function cleanSchedule(raw: unknown): Schedule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const at = Number(r.at);
  if (!Number.isFinite(at) || at < Date.now() - 365 * 86400000 || at > Date.now() + 2 * 365 * 86400000) return undefined;
  const durationMin = Math.min(240, Math.max(10, Math.round(Number(r.durationMin) || 45)));
  const visioUrl = typeof r.visioUrl === 'string' && /^https:\/\/\S+$/.test(r.visioUrl) ? r.visioUrl.slice(0, 300) : undefined;
  const recruiterName = typeof r.recruiterName === 'string' ? r.recruiterName.slice(0, 80) : undefined;
  const alternatives = Array.isArray(r.alternatives) ? r.alternatives.map(Number).filter((n) => Number.isFinite(n) && n > Date.now() - 86400000).slice(0, 12) : undefined;
  return { at, durationMin, visioUrl, recruiterName, alternatives };
}

const app = express();
app.set('trust proxy', true);

// Sécurité : HTTPS imposé derrière un proxy TLS (FORCE_HTTPS=1), et en-têtes qui évitent les fuites de jetons.
app.use((req, res, next) => {
  if (forceHttps) {
    if (!req.secure) return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer'); // les liens contiennent des jetons : jamais transmis à un autre site
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  next();
});
app.use(cors());
app.use(express.json());
// Les entretiens sont sauvegardés après chaque requête qui les modifie.
app.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', schedulePersist);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Création par le recruteur : il indique le responsable du traitement (son entreprise) et un contact pour les droits.
app.post('/api/sessions', async (req, res) => {
  const body = (req.body ?? {}) as { candidateLabel?: string; candidateEmail?: string; controllerName?: string; controllerContact?: string; schedule?: unknown };
  const name = String(body.controllerName ?? '').trim().slice(0, 120);
  const contact = String(body.controllerContact ?? '').trim().slice(0, 160);
  const session = createSession(
    String(body.candidateLabel ?? 'Candidat').slice(0, 120),
    name ? { name, contact } : undefined,
    cleanSchedule(body.schedule),
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.candidateEmail ?? '')) ? String(body.candidateEmail).slice(0, 160) : undefined,
  );
  // Seule réponse qui contient le jeton du recruteur : à garder, il donne accès aux signaux et au rapport.
  res.status(201).json({ ...(await viewWithAgent(session)), recruiterKey: session.recruiterKey });
});

// Créneau : le recruteur le fixe, le déplace, ou accepte la contre-proposition du candidat.
app.post('/api/sessions/:id/schedule', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id)!;
  const next = cleanSchedule(req.body);
  if (!next) return res.status(400).json({ error: 'créneau invalide' });
  const prev = session.schedule;
  // Même créneau que la contre-proposition du candidat : elle devient une confirmation.
  const confirme = prev?.response?.kind === 'proposed' && prev.response.slot === next.at;
  session.schedule = { ...next, response: confirme ? { kind: 'confirmed', at: Date.now(), slot: next.at } : prev?.response?.kind === 'confirmed' && prev.at === next.at ? prev.response : undefined };
  audit(session, 'recruteur', 'Créneau', `${new Date(next.at).toISOString()} · ${next.durationMin} min${confirme ? ' (proposition du candidat acceptée)' : ''}`);
  schedulePersist();
  res.json(await viewWithAgent(session));
});

app.get('/api/sessions/:id', recruiterOnly, async (req, res) => {
  res.json(await viewWithAgent(getSession(req.params.id)!));
});

// Brique B : résultat d'un défi exécuté pendant l'entretien.
app.post('/api/sessions/:id/challenges', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id)!;
  const { challengeId, result, durationMs, metrics } = req.body as {
    challengeId: string;
    result: ChallengeResult;
    durationMs: number;
    metrics?: unknown;
  };
  if (!['passed', 'failed', 'inconclusive'].includes(result)) return res.status(400).json({ error: 'résultat inconnu' });
  if (!recordChallenge(session, challengeId, result, Number(durationMs) || 0, 'live', cleanMetrics(metrics))) {
    return res.status(400).json({ error: 'défi inconnu' });
  }
  audit(session, 'recruteur', 'Défi en direct', `${getChallenge(challengeId)?.label ?? challengeId} : ${result}`);
  res.json(await viewWithAgent(session));
});

app.use(candidateRouter);
app.use(flashRouter);
app.use(liveRouter);
app.use(presenceRouter);

// CV chargé par le recruteur à la création de l'entretien (jamais par le candidat). Lu puis oublié : on garde ce qui
// a été trouvé pour pré-remplir le candidat, et pour comparer ensuite ses déclarations à son CV.
app.post('/api/sessions/:id/cv', recruiterOnly, express.raw({ type: 'application/pdf', limit: '8mb' }), async (req, res) => {
  const session = getSession(req.params.id)!;
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'PDF manquant' });
  let texte: string;
  try { texte = await extraireTexte(req.body); } catch { return res.status(422).json({ error: 'CV illisible (PDF scanné ou protégé)' }); }
  const local = analyserTexte(texte);
  let found = local.found, consistent: string[] = [], links: CvAnalysis['links'] = [], inconsistencies: CvResult['inconsistencies'] = [];
  // L'agent, s'il répond et si le candidat a déjà déclaré ses informations, affine la comparaison et donne les liens.
  if (session.identity) {
    try {
      const { status, body } = await analyzeCv(session, req.body);
      if (status === 200) { const cv = body as CvResult; found = { ...local.found, ...cv.found }; consistent = cv.consistent; links = cv.links; inconsistencies = cv.inconsistencies; }
    } catch { /* agent absent : comparaison locale ci-dessous */ }
  }
  session.cv = { analyzedAt: Date.now(), found, consistent, links, prefill: local.prefill };
  session.signals = session.signals.filter((s) => s.source !== 'cv');
  const at = Date.now();
  if (session.identity) {
    const { consentAt, ...declared } = session.identity;
    const cmp = comparerCv(found, declared, at);
    session.cv.consistent = [...new Set([...consistent, ...cmp.consistent])];
    upsertSignals(session, [
      ...cmp.signals,
      ...inconsistencies.map((i) => ({ id: i.field, source: 'cv' as const, severity: 'medium' as const, status: 'contradiction' as const, label: i.label, detail: i.detail, at })),
    ]);
  }
  audit(session, 'recruteur', 'CV chargé', `${found.emails.length} e-mail(s), ${found.phones.length} téléphone(s), ${found.github.length + found.linkedin.length} profil(s), ${found.schools.length} formation(s)`);
  schedulePersist();
  res.json(await viewWithAgent(session));
});

// Lecture d'un CV avant même la création de l'entretien : de quoi pré-remplir le formulaire du recruteur.
app.post('/api/cv/extract', express.raw({ type: 'application/pdf', limit: '8mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'PDF manquant' });
  try { res.json(analyserTexte(await extraireTexte(req.body))); } catch { res.status(422).json({ error: 'CV illisible (PDF scanné ou protégé)' }); }
});

app.post('/api/sessions/:id/decision', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id)!;
  const { value, note } = req.body as { value: Decision; note?: string };
  if (!['poursuivre', 'refaire_defi', 'presentiel'].includes(value)) return res.status(400).json({ error: 'décision inconnue' });
  session.decision = { value, note, at: Date.now() };
  audit(session, 'recruteur', 'Décision', value);
  purgeBiometrics(session, 'décision du recruteur', 'recruteur');
  res.json(await viewWithAgent(session));
});

// Mode partage : le serveur sert aussi le site construit (apps/web/dist), donc un seul tunnel suffit.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(join(webDist, 'index.html')));
}

const server = createServer(app);
attachSignaling(server);
server.listen(PORT, () => {
  console.log(`Serveur KYC visio sur http://localhost:${PORT}`);
});
