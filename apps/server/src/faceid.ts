import { randomBytes, randomInt } from 'node:crypto';
import express from 'express';
import {
  ANGLE_MAX_YAW_DEG,
  MIN_PROFILE_SAMPLES,
  combineContinuity,
  cosine,
  findVirtualCameras,
  isProbability,
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
  type LiveSample,
} from '@kyc/shared';
import { recruiterOnly } from './auth.ts';
import { recordChallenge } from './challenges.ts';
import { thresholds } from './config.ts';
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

  // Une caméra virtuelle installée (OBS pour le streaming, par exemple) n'est pas suspecte si la vérification
  // se fait avec une vraie caméra : on la garde comme information, sans effet sur le score.
  const installed = session.signals.find((s) => s.id === 'precheck.virtual-camera');
  if (installed?.status === 'contradiction' && cameraLabel) {
    const name = installed.detail.match(/« (.+?) »/)?.[1] ?? 'une caméra virtuelle';
    upsertSignals(session, [
      {
        ...installed,
        status: 'unknown',
        at: Date.now(),
        label: 'Caméra virtuelle installée, non utilisée',
        detail: `« ${name} » est installée, mais la vérification du visage s'est faite avec « ${cameraLabel} ». Sans effet sur le score.`,
      },
    ]);
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
    // Empreinte calculée dans le navigateur du candidat : seul ce vecteur arrive ici, jamais une image.
    if (isValidEmbedding(body.embedding)) session.faceProfile.embedding = meanEmbedding([body.embedding]);
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

  if (Array.isArray(body.passive)) session.passiveScores = body.passive.filter(isProbability).slice(-15);

  plan.completedAt = Date.now();
  session.precheckDone = true;
  schedulePersist();
  res.json({
    profileStored: Boolean(session.faceProfile),
    steps: body.results.map((r) => ({ step: r.step, result: r.result })),
  });
});

// Pendant l'entretien (visio de secours), la page du candidat indique la caméra réellement utilisée.
faceIdRouter.post('/api/sessions/:id/live-camera', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'session inconnue' });
  const cameraLabel = String((req.body as { cameraLabel?: string })?.cameraLabel ?? '').slice(0, 120);
  const virtual = findVirtualCameras([cameraLabel]);
  if (virtual.length > 0) {
    upsertSignals(session, [
      {
        id: 'live.virtual-camera',
        source: 'precheck',
        severity: 'strong',
        at: Date.now(),
        status: 'contradiction',
        label: "Caméra virtuelle utilisée pendant l'entretien",
        detail: `Caméra du candidat : « ${virtual[0]} ». Un nom de périphérique n'est pas une preuve : à confirmer par un défi.`,
      },
    ]);
    schedulePersist();
  }
  res.json({ checked: true });
});

// --- Pendant l'entretien : la personne est-elle la même qu'à la pré-vérification ? ---
// Deux contrôles indépendants, calculés dans le navigateur du recruteur : l'empreinte faciale et les proportions du
// visage. Le serveur ne reçoit que ces nombres ; il garde en mémoire les similarités, jamais les empreintes reçues.
const similarities = new Map<string, number[]>();
const geometry = new Map<string, number[]>();

function push(map: Map<string, number[]>, id: string, value: number) {
  const list = map.get(id) ?? [];
  list.push(value);
  if (list.length > 30) list.shift();
  map.set(id, list);
}

function pct(x: number) {
  return `${Math.round(x * 1000) / 10} %`;
}

function updateContinuity(session: Session) {
  const sims = similarities.get(session.id) ?? [];
  const dists = geometry.get(session.id) ?? [];
  const verdict = combineContinuity(
    judgeIdentity(sims, thresholds.samePersonMin, thresholds.differentPersonMax),
    judgeContinuity(dists, thresholds.sameShapeMax, thresholds.differentShapeMin),
  );

  const parts = [
    sims.length
      ? `empreinte : similarité médiane ${median(sims).toFixed(2)} sur ${sims.length} capture(s) (même personne au-dessus de ${thresholds.samePersonMin}, différente sous ${thresholds.differentPersonMax})`
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

// Le panneau recruteur envoie, toutes les 2 s et pendant les défis, des mesures du visage affiché calculées dans son
// navigateur : proportions (comparées au profil de face ou sous l'angle le plus proche), empreinte, probabilité de
// trucage. Aucune image n'est acceptée ici.
faceIdRouter.post('/api/sessions/:id/live-sample', recruiterOnly, (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'mesures uniquement, jamais d\'image' });
  const session = getSession(req.params.id)!;
  const { ratios, yawDeg, embedding, fakeProbability } = (req.body ?? {}) as LiveSample;
  if (isProbability(fakeProbability)) session.passiveScores = [...(session.passiveScores ?? []), fakeProbability].slice(-15);

  const profile = session.faceProfile;
  if (!profile) return res.json({ verdict: 'unknown', reason: 'pas de profil' });
  if (isValidEmbedding(embedding) && profile.embedding) push(similarities, session.id, cosine(profile.embedding, embedding));
  if (isValidRatios(ratios) && Number.isFinite(yawDeg)) {
    const reference = referenceFor(profile, yawDeg!);
    if (reference) push(geometry, session.id, ratioDistance(reference, ratios));
  }
  res.json({ verdict: updateContinuity(session) });
});
