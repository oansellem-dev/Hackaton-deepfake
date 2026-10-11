import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { getChallenge, type ChallengeResult, type Decision } from '@kyc/shared';
import { analyzeCv, viewWithAgent, type CvResult } from './agent.ts';
import { audit } from './audit.ts';
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
  const body = (req.body ?? {}) as { candidateLabel?: string; controllerName?: string; controllerContact?: string };
  const name = String(body.controllerName ?? '').trim().slice(0, 120);
  const contact = String(body.controllerContact ?? '').trim().slice(0, 160);
  const session = createSession(
    String(body.candidateLabel ?? 'Candidat').slice(0, 120),
    name ? { name, contact } : undefined,
  );
  // Seule réponse qui contient le jeton du recruteur : à garder, il donne accès aux signaux et au rapport.
  res.status(201).json({ ...(await viewWithAgent(session)), recruiterKey: session.recruiterKey });
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

// CV chargé par le recruteur (jamais par le candidat : son parcours reste léger). Comparé à ses déclarations,
// puis oublié : on garde seulement les écarts, les éléments concordants et les liens de vérification.
app.post('/api/sessions/:id/cv', recruiterOnly, express.raw({ type: 'application/pdf', limit: '8mb' }), async (req, res) => {
  const session = getSession(req.params.id)!;
  if (!session.identity) {
    return res.status(409).json({ error: "le candidat n'a pas encore rempli ses informations" });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'PDF manquant' });
  try {
    const { status, body } = await analyzeCv(session, req.body);
    if (status !== 200) return res.status(status).json({ error: (body as { detail?: string }).detail ?? 'CV illisible' });
    const cv = body as CvResult;
    session.cv = { analyzedAt: Date.now(), found: cv.found, consistent: cv.consistent, links: cv.links };
    session.signals = session.signals.filter((s) => s.source !== 'cv');
    const at = Date.now();
    upsertSignals(session, [
      ...cv.inconsistencies.map((i) => ({
        id: i.field,
        source: 'cv' as const,
        severity: 'medium' as const,
        status: 'contradiction' as const,
        label: i.label,
        detail: i.detail,
        at,
      })),
      ...(cv.consistent.length
        ? [
            {
              id: 'cv.consistent',
              source: 'cv' as const,
              severity: 'medium' as const,
              status: 'ok' as const,
              label: 'Concordant avec le CV',
              detail: `Identique dans le CV et la pré-vérification : ${cv.consistent.join(', ')}.`,
              at,
            },
          ]
        : []),
    ]);
    audit(session, 'recruteur', 'CV comparé aux déclarations', `${cv.inconsistencies.length} écart(s), CV non conservé`);
    res.json(await viewWithAgent(session));
  } catch {
    res.status(503).json({ error: 'agent injoignable' });
  }
});

// Suppression manuelle du gabarit biométrique par le recruteur, à tout moment.
app.delete('/api/sessions/:id/biometrics', recruiterOnly, async (req, res) => {
  const session = getSession(req.params.id)!;
  purgeBiometrics(session, 'suppression manuelle', 'recruteur');
  res.json(await viewWithAgent(session));
});

// Règle n°2 : la décision appartient au recruteur, on la trace pour le rapport (brique E).
// Elle clôt l'entretien : le gabarit biométrique est supprimé.
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
