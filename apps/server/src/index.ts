import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { getChallenge, type ChallengeResult, type Decision, type PrecheckPayload } from '@kyc/shared';
import { precheckSignals } from './precheck.ts';
import { attachSignaling } from './signaling.ts';
import { forwardFrame, viewWithAgent } from './agent.ts';
import { createSession, getSession, upsertSignals } from './store.ts';

const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/sessions', async (req, res) => {
  const session = createSession(String(req.body?.candidateLabel ?? 'Candidat'));
  res.status(201).json(await viewWithAgent(session));
});

app.get('/api/sessions/:id', async (req, res) => {
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
app.post('/api/sessions/:id/challenges', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

  const { challengeId, result, durationMs } = req.body as {
    challengeId: string;
    result: ChallengeResult;
    durationMs: number;
  };
  const challenge = getChallenge(challengeId);
  if (!challenge) return res.status(400).json({ error: 'défi inconnu' });

  const at = Date.now();
  session.challenges.push({ challengeId, result, durationMs, at });
  upsertSignals(session, [
    {
      id: `challenge.${challengeId}.${session.challenges.length}`,
      source: 'challenge',
      severity: 'strong',
      at,
      status: result === 'failed' ? 'contradiction' : result === 'passed' ? 'ok' : 'unknown',
      label:
        result === 'failed'
          ? `Défi « ${challenge.label} » non exécuté ou image déformée`
          : `Défi « ${challenge.label} »`,
      detail:
        result === 'passed'
          ? 'Exécuté correctement.'
          : result === 'failed'
            ? 'À reproposer avant de conclure.'
            : 'Résultat non concluant, sans effet sur le score.',
    },
  ]);
  res.json(await viewWithAgent(session));
});

// Détecteur passif : le panneau envoie une capture du visage (JPEG) toutes les ~2 s.
// Elle est transmise à l'agent local, analysée en mémoire, jamais conservée.
app.post('/api/sessions/:id/frame', express.raw({ type: 'image/*', limit: '2mb' }), async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'image manquante' });
  try {
    const { status, body } = await forwardFrame(session.id, req.body, req.headers['content-type'] ?? 'image/jpeg');
    res.status(status).json(body);
  } catch {
    res.status(503).json({ error: 'agent injoignable' });
  }
});

// Règle n°2 : la décision appartient au recruteur, on la trace pour le rapport (brique E).
app.post('/api/sessions/:id/decision', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

  const { value, note } = req.body as { value: Decision; note?: string };
  session.decision = { value, note, at: Date.now() };
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
