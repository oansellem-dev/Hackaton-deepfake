import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import type { ChallengeResult, Decision, PrecheckPayload } from '@kyc/shared';
import { precheckSignals } from './precheck.ts';
import { attachSignaling } from './signaling.ts';
import { forwardFrame, viewWithAgent } from './agent.ts';
import { hasRecruiterKey, recruiterOnly } from './auth.ts';
import { cleanMetrics, recordChallenge } from './challenges.ts';
import { faceIdRouter, onFrameEmbedding } from './faceid.ts';
import { createSession, getSession, purgeBiometrics, schedulePersist, upsertSignals } from './store.ts';

const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
// Les sessions (et leur profil de visage chiffré) sont sauvegardées après chaque requête qui les modifie.
app.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', schedulePersist);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/sessions', async (req, res) => {
  const session = createSession(String(req.body?.candidateLabel ?? 'Candidat'));
  // Seule réponse qui contient le jeton du recruteur : à garder, il donne accès aux signaux et au rapport.
  res.status(201).json({ ...(await viewWithAgent(session)), recruiterKey: session.recruiterKey });
});

app.get('/api/sessions/:id', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  res.json(await viewWithAgent(session));
});

// Brique A : la page candidat envoie ses signaux d'environnement.
app.post('/api/sessions/:id/precheck', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

  const payload = req.body as PrecheckPayload;
  const signals = precheckSignals(payload, req.ip ?? 'inconnue');
  upsertSignals(session, signals);
  session.precheckDone = true;

  // On renvoie au candidat ce qui a été vérifié, pas le score.
  res.json({ signals: signals.map(({ label, status, detail }) => ({ label, status, detail })) });
});

// Brique B : résultat d'un défi exécuté pendant l'entretien.
app.post('/api/sessions/:id/challenges', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

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
  res.json(await viewWithAgent(session));
});

app.use(faceIdRouter);

// Détecteur passif : le panneau envoie une capture du visage (JPEG) toutes les ~2 s.
// Elle est transmise à l'agent local, analysée en mémoire, jamais conservée.
app.post('/api/sessions/:id/frame', express.raw({ type: 'image/*', limit: '2mb' }), async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  // Le candidat n'envoie des captures que pendant sa vérification du visage ; ensuite, seul le recruteur le peut.
  const precheck = req.query.phase === 'precheck';
  const faceIdOpen =
    !!session.faceId && (!session.faceId.completedAt || Date.now() - session.faceId.completedAt < 60_000);
  if (!(precheck && faceIdOpen) && !hasRecruiterKey(req, session.recruiterKey)) {
    return res.status(403).json({ error: 'réservé au recruteur' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'image manquante' });
  try {
    const { status, body } = await forwardFrame(session.id, req.body, req.headers['content-type'] ?? 'image/jpeg');
    const { embedding, ...rest } = (body ?? {}) as { embedding?: unknown; frame?: { fake_probability?: unknown } };
    onFrameEmbedding(session, embedding, precheck ? 'precheck' : 'live');
    const p = rest.frame?.fake_probability;
    if (typeof p === 'number' && Number.isFinite(p)) session.passiveScores = [...(session.passiveScores ?? []), p].slice(-15);
    // L'empreinte reste sur le serveur : le navigateur ne reçoit que le résultat du détecteur passif.
    res.status(status).json(rest);
  } catch {
    res.status(503).json({ error: 'agent injoignable' });
  }
});

// Règle n°2 : la décision appartient au recruteur, on la trace pour le rapport (brique E).
app.post('/api/sessions/:id/decision', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

  const { value, note } = req.body as { value: Decision; note?: string };
  session.decision = { value, note, at: Date.now() };
  // L'entretien est tranché : les proportions du visage (biométrie) sont effacées.
  purgeBiometrics(session);
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
