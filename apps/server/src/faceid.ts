import { randomBytes, randomInt } from 'node:crypto';
import express from 'express';
import {
  ANGLE_MAX_YAW_DEG,
  DIFFERENT_PERSON_MAX,
  MIN_PROFILE_EMBEDDINGS,
  MIN_PROFILE_SAMPLES,
  SAME_PERSON_MIN,
  combineContinuity,
  cosine,
  findVirtualCameras,
  isValidEmbedding,
  isValidRatios,
  judgeContinuity,
  judgeIdentity,
  meanEmbedding,
  median,
  ratioDistance,
  referenceFor,
  type Session,
  type AngleProfile,
  type FaceIdPlan,
  type FaceIdStep,
  type FaceIdSubmission,
  type IdentityPayload,
} from '@kyc/shared';
import { recordChallenge } from './challenges.ts';
import { declaredInfoSignals, lookupWebPresence, sanitizeIdentity } from './identity.ts';
import { getSession, schedulePersist, upsertSignals } from './store.ts';

// Lien de pré-vérification : page 1 identité et informations écrites (avec consentement), page 2 « Face ID »,
// puis, pendant l'entretien, comparaison des proportions du visage avec celles de la pré-vérification.
export const faceIdRouter = express.Router();

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Page 1 : identité, informations écrites et consentement. Rien de trouvé = aucun effet sur le score.
faceIdRouter.post('/api/sessions/:id/identity', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (session.faceId?.completedAt) return res.status(409).json({ error: 'pré-vérification déjà terminée' });

  const payload = req.body as IdentityPayload;
  if (payload?.consent !== true) return res.status(400).json({ error: 'consentement requis' });
  const identity = sanitizeIdentity(payload);
  if (!identity) return res.status(400).json({ error: 'nom et prénom requis' });

  session.identity = { ...identity, consentAt: Date.now() };
  session.candidateLabel = `${identity.firstName} ${identity.lastName}`;
  const [presence, declared] = await Promise.all([
    lookupWebPresence(identity.firstName, identity.lastName),
    declaredInfoSignals(identity),
  ]);
  // Une nouvelle saisie remplace la précédente (correction d'une faute de frappe).
  session.signals = session.signals.filter((s) => s.source !== 'identity');
  upsertSignals(session, [presence, ...declared]);
  schedulePersist();
  // Le candidat apprend seulement que c'est enregistré : les résultats sont pour le recruteur.
  res.json({ checked: true });
});

// Page 2 : le serveur tire la séquence au hasard. Parcours durci si un signal à vérifier existe déjà,
// jamais à cause d'une simple absence de trace. Seule la caméra de l'appareil est acceptée.
faceIdRouter.post('/api/sessions/:id/faceid/start', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!session.identity) return res.status(409).json({ error: 'consentement requis avant la caméra' });
  if (session.faceId?.completedAt) return res.status(409).json({ error: 'pré-vérification déjà terminée' });

  const cameraLabel = String((req.body as { cameraLabel?: string })?.cameraLabel ?? '').slice(0, 120);
  const virtual = findVirtualCameras([cameraLabel]);
  if (virtual.length > 0) {
    upsertSignals(session, [
      {
        id: 'precheck.virtual-camera',
        source: 'precheck',
        severity: 'strong',
        at: Date.now(),
        status: 'contradiction',
        label: 'Vérification du visage tentée avec une caméra virtuelle',
        detail: `Caméra utilisée : « ${virtual[0]} ». Le candidat a été invité à utiliser la caméra de son appareil.`,
      },
    ]);
    schedulePersist();
    return res.status(409).json({ error: 'camera-virtuelle', camera: virtual[0] });
  }

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

function validAngles(angles: unknown): AngleProfile[] {
  if (!Array.isArray(angles)) return [];
  return angles
    .filter(
      (a): a is AngleProfile =>
        a &&
        Number.isFinite(a.yawDeg) &&
        Math.abs(a.yawDeg) <= ANGLE_MAX_YAW_DEG &&
        isValidRatios(a.ratios) &&
        Number.isInteger(a.samples),
    )
    .slice(0, 4)
    .map((a) => ({ yawDeg: a.yawDeg, ratios: a.ratios, samples: a.samples }));
}

// Fin du parcours : résultats des étapes + proportions du visage. Les images n'arrivent jamais ici.
faceIdRouter.post('/api/sessions/:id/faceid/submit', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  const plan = session.faceId;
  const body = req.body as FaceIdSubmission;
  if (!plan || plan.completedAt || body?.nonce !== plan.nonce) return res.status(409).json({ error: 'parcours invalide' });
  if (plan.steps.some((step, i) => body.results?.[i]?.step !== step)) {
    return res.status(400).json({ error: 'les étapes ne correspondent pas au parcours demandé' });
  }

  for (const r of body.results) {
    if (r.step === 'center') continue;
    const result = ['passed', 'failed', 'inconclusive'].includes(r.result) ? r.result : 'inconclusive';
    recordChallenge(session, r.step === 'hand' ? 'hand-over-face' : 'head-turn', result, Number(r.durationMs) || 0, 'precheck');
  }

  const center = body.results.find((r) => r.step === 'center');
  const angles = validAngles(body.angles);
  if (center?.result !== 'failed' && isValidRatios(body.ratios) && body.samples >= MIN_PROFILE_SAMPLES) {
    session.faceProfile = { ratios: body.ratios, samples: body.samples, angles, createdAt: Date.now() };
    finalizeEmbedding(session);
    upsertSignals(session, [
      {
        id: 'face.profile',
        source: 'face',
        severity: 'medium',
        status: 'ok',
        label: 'Profil du visage enregistré',
        detail:
          `Empreinte et proportions du visage mesurées de face${angles.length ? ` et sous ${angles.length} angle(s)` : ''}, ` +
          "comparées ensuite pendant l'entretien. Aucune image conservée, effacées à votre décision.",
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

// --- Pendant l'entretien : la personne est-elle la même qu'à la pré-vérification ? ---
// Deux contrôles indépendants : l'empreinte faciale (calculée par l'agent sur les captures) et les proportions
// du visage (mesurées par le panneau). Seules les mesures sont gardées, en mémoire, jamais les images.
const precheckEmbeddings = new Map<string, number[][]>();
const similarities = new Map<string, number[]>();
const geometry = new Map<string, number[]>();

function push(map: Map<string, number[]>, id: string, value: number) {
  const list = map.get(id) ?? [];
  list.push(value);
  if (list.length > 30) list.shift();
  map.set(id, list);
}

// L'empreinte de référence est la moyenne des captures de la pré-vérification (elles peuvent arriver juste après la fin).
function finalizeEmbedding(session: Session) {
  const list = precheckEmbeddings.get(session.id) ?? [];
  if (session.faceProfile && !session.faceProfile.embedding && list.length >= MIN_PROFILE_EMBEDDINGS) {
    session.faceProfile.embedding = meanEmbedding(list);
    precheckEmbeddings.delete(session.id);
    schedulePersist();
  }
}

export function onFrameEmbedding(session: Session, embedding: unknown, phase: 'precheck' | 'live') {
  if (!isValidEmbedding(embedding)) return;
  if (phase === 'precheck') {
    const list = precheckEmbeddings.get(session.id) ?? [];
    if (list.length < 20) list.push(embedding);
    precheckEmbeddings.set(session.id, list);
    finalizeEmbedding(session);
    return;
  }
  if (!session.faceProfile?.embedding) return;
  push(similarities, session.id, cosine(session.faceProfile.embedding, embedding));
  updateContinuity(session);
}

function pct(x: number) {
  return `${Math.round(x * 1000) / 10} %`;
}

function updateContinuity(session: Session) {
  const sims = similarities.get(session.id) ?? [];
  const dists = geometry.get(session.id) ?? [];
  const verdict = combineContinuity(judgeIdentity(sims), judgeContinuity(dists));

  const parts = [
    sims.length
      ? `empreinte : similarité médiane ${median(sims).toFixed(2)} sur ${sims.length} capture(s) (même personne au-dessus de ${SAME_PERSON_MIN}, différente sous ${DIFFERENT_PERSON_MAX})`
      : 'empreinte : pas encore de capture',
    dists.length
      ? `proportions : écart médian ${pct(median(dists))} sur ${dists.length} mesure(s)`
      : 'proportions : pas encore de mesure',
  ];
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
          : verdict === 'consistent'
            ? "Même visage qu'à la pré-vérification"
            : 'Continuité du visage depuis la pré-vérification',
      detail:
        `${parts.join(' · ')}.` +
        (verdict === 'different'
          ? " Lunettes, barbe ou éclairage peuvent l'expliquer : à vérifier avec le candidat."
          : verdict === 'unknown'
            ? ' Pas encore de conclusion, sans effet sur le score.'
            : ''),
    },
  ]);
  return verdict;
}

// Le panneau envoie les proportions du visage affiché ; comparées au profil de face ou sous l'angle le plus proche.
faceIdRouter.post('/api/sessions/:id/face-sample', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  if (!session.faceProfile) return res.json({ verdict: 'unknown', reason: 'pas de profil' });

  const { ratios, yawDeg } = req.body as { ratios?: number[]; yawDeg?: number };
  if (!isValidRatios(ratios) || !Number.isFinite(yawDeg)) return res.status(400).json({ error: 'mesure invalide' });
  const reference = referenceFor(session.faceProfile, yawDeg!);
  if (!reference) return res.json({ verdict: 'unknown', reason: 'angle sans profil de référence' });

  push(geometry, session.id, ratioDistance(reference, ratios));
  const verdict = updateContinuity(session);
  res.json({ verdict, samples: (geometry.get(session.id) ?? []).length });
});
