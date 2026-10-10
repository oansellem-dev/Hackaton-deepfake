import { randomBytes } from 'node:crypto';
import express from 'express';
import {
  DIFFERENT_FACE_MIN,
  LIVE_MAX_YAW_DEG,
  MIN_PROFILE_SAMPLES,
  RATIO_NAMES,
  SAME_FACE_MAX,
  judgeContinuity,
  median,
  ratioDistance,
  type FaceIdPlan,
  type FaceIdStep,
  type FaceIdSubmission,
} from '@kyc/shared';
import { recordChallenge } from './challenges.ts';
import { lookupIdentity } from './identity.ts';
import { getSession, schedulePersist, upsertSignals } from './store.ts';

// Lien de pré-vérification : identité déclarée (avec consentement), puis parcours « Face ID »,
// puis, pendant l'entretien, comparaison des proportions du visage avec celles de la pré-vérification.
export const faceIdRouter = express.Router();

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Étape 1 : nom, prénom et consentement. Le nom sert à une recherche publique ; rien n'est trouvé = aucun effet sur le score.
faceIdRouter.post('/api/sessions/:id/identity', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });

  const { firstName, lastName, consent } = req.body as { firstName?: string; lastName?: string; consent?: boolean };
  if (!consent) return res.status(400).json({ error: 'consentement requis' });
  const first = String(firstName ?? '').trim().slice(0, 80);
  const last = String(lastName ?? '').trim().slice(0, 80);
  if (!first || !last) return res.status(400).json({ error: 'nom et prénom requis' });

  session.identity = { firstName: first, lastName: last, consentAt: Date.now() };
  session.candidateLabel = `${first} ${last}`;
  const signal = await lookupIdentity(first, last);
  upsertSignals(session, [signal]);
  schedulePersist();
  // Le candidat voit seulement ce qui a été vérifié, pas les résultats de la recherche.
  res.json({ checked: true, status: signal.status });
});

// Étape 3 : le serveur tire la séquence au hasard (une vidéo préparée à l'avance ne peut pas la deviner).
// Parcours durci si un signal à vérifier existe déjà ; jamais à cause d'une simple absence de trace.
faceIdRouter.post('/api/sessions/:id/faceid/start', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!session.identity) return res.status(409).json({ error: 'consentement requis avant la caméra' });

  const hardened = session.signals.some((s) => s.status === 'contradiction');
  const core: FaceIdStep[] = ['turn_a', 'turn_b', 'hand'];
  const extra: FaceIdStep[] = hardened ? ['hand', 'turn_a', 'turn_b'] : [];
  const plan: FaceIdPlan = {
    nonce: randomBytes(12).toString('hex'),
    steps: ['center', ...shuffle([...core, ...extra])],
    hardened,
  };
  session.faceId = { ...plan, startedAt: Date.now() };
  schedulePersist();
  res.json(plan);
});

// Fin du parcours : résultats des étapes + proportions du visage. Les images n'arrivent jamais ici.
faceIdRouter.post('/api/sessions/:id/faceid/submit', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  const plan = session.faceId;
  const body = req.body as FaceIdSubmission;
  if (!plan || plan.completedAt || body.nonce !== plan.nonce) return res.status(409).json({ error: 'parcours invalide' });
  if (plan.steps.some((step, i) => body.results?.[i]?.step !== step)) {
    return res.status(400).json({ error: 'les étapes ne correspondent pas au parcours demandé' });
  }

  // Les virages à gauche et à droite sont jugés ensemble par le client (signes opposés) ; ici on enregistre chaque étape.
  for (const r of body.results) {
    if (r.step === 'center') continue;
    recordChallenge(session, r.step === 'hand' ? 'hand-over-face' : 'head-turn', r.result, r.durationMs, 'precheck');
  }

  const center = body.results.find((r) => r.step === 'center');
  const validRatios =
    Array.isArray(body.ratios) &&
    body.ratios.length === RATIO_NAMES.length &&
    body.ratios.every((n) => Number.isFinite(n)) &&
    body.samples >= MIN_PROFILE_SAMPLES;

  if (center?.result !== 'failed' && validRatios) {
    session.faceProfile = { ratios: body.ratios, samples: body.samples, createdAt: Date.now() };
    upsertSignals(session, [
      {
        id: 'face.profile',
        source: 'face',
        severity: 'medium',
        status: 'ok',
        label: 'Profil du visage enregistré',
        detail: 'Proportions mesurées de face, comparées ensuite pendant l\'entretien. Aucune image conservée.',
        at: Date.now(),
      },
    ]);
  } else {
    upsertSignals(session, [
      {
        id: 'face.profile',
        source: 'face',
        severity: 'medium',
        status: 'unknown',
        label: 'Profil du visage',
        detail: 'Mesure impossible (lumière, cadrage ou suivi insuffisants). Sans effet sur le score.',
        at: Date.now(),
      },
    ]);
  }

  plan.completedAt = Date.now();
  session.precheckDone = true;
  schedulePersist();
  res.json({
    profileStored: Boolean(session.faceProfile),
    steps: body.results.map((r) => ({ step: r.step, result: r.result })),
  });
});

// Pendant l'entretien : le panneau mesure le visage affiché et compare au profil de la pré-vérification.
const distances = new Map<string, number[]>();

faceIdRouter.post('/api/sessions/:id/face-sample', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!session.faceProfile) return res.json({ verdict: 'unknown', reason: 'pas de profil' });

  const { ratios, yawDeg } = req.body as { ratios?: number[]; yawDeg?: number };
  if (!Array.isArray(ratios) || ratios.length !== RATIO_NAMES.length || !ratios.every(Number.isFinite)) {
    return res.status(400).json({ error: 'mesure invalide' });
  }
  // Les proportions ne sont comparables que de face.
  if (Math.abs(yawDeg ?? 0) > LIVE_MAX_YAW_DEG) return res.json({ verdict: 'unknown', reason: 'visage de profil' });

  const list = distances.get(session.id) ?? [];
  list.push(ratioDistance(session.faceProfile.ratios, ratios));
  if (list.length > 30) list.shift();
  distances.set(session.id, list);

  const verdict = judgeContinuity(list);
  const m = Math.round(median(list) * 1000) / 10;
  upsertSignals(session, [
    {
      id: 'face.continuity',
      source: 'face',
      severity: 'strong',
      at: Date.now(),
      status: verdict === 'different' ? 'contradiction' : verdict === 'consistent' ? 'ok' : 'unknown',
      label:
        verdict === 'different'
          ? 'Visage différent de celui de la pré-vérification'
          : 'Continuité du visage depuis la pré-vérification',
      detail:
        verdict === 'different'
          ? `Écart médian ${m} % (seuil ${DIFFERENT_FACE_MIN * 100} %). Lunettes, barbe ou éclairage peuvent l'expliquer : à vérifier avec le candidat.`
          : verdict === 'consistent'
            ? `Écart médian ${m} % (seuil ${SAME_FACE_MAX * 100} %).`
            : `Pas assez de mesures de face pour conclure (${list.length}), sans effet sur le score.`,
    },
  ]);
  res.json({ verdict, samples: list.length });
});
