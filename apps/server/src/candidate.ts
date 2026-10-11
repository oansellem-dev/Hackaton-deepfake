import { randomBytes, randomInt } from 'node:crypto';
import { FLASH_MAX_ATTEMPTS, describeFlash, sanitizeFlashAttempt, type FlashSubmission } from '@kyc/shared';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  ANGLE_MAX_YAW_DEG,
  CONSENT_VERSION,
  MIN_PROFILE_SAMPLES,
  findVirtualCameras,
  isProbability,
  isValidEmbedding,
  isValidRatios,
  meanEmbedding,
  type AngleProfile,
  type CandidateLinkInfo,
  type FaceIdPlan,
  type FaceIdStep,
  type FaceIdSubmission,
  type IdentityPayload,
  type PrecheckPayload,
  type Session,
} from '@kyc/shared';
import { audit } from './audit.ts';
import { recordChallenge } from './challenges.ts';
import { retention } from './config.ts';
import { declaredInfoSignals, lookupWebPresence, sanitizeIdentity } from './identity.ts';
import { precheckSignals } from './precheck.ts';
import {
  getFaceProfile,
  getSessionByCandidateToken,
  linkStatus,
  markLinkUsed,
  purgeBiometrics,
  schedulePersist,
  setFaceProfile,
  upsertSignals,
} from './store.ts';
import { registrationOptions, verifyRegistration } from './webauthn.ts';

// Lien de pré-vérification (/check/<jeton>) : jeton non devinable, expiration courte, usage unique.
// Page 1 : identité et informations écrites. Page 2 : consentement biométrique explicite, puis « Face ID »
// (ou vérification sans biométrie). Le candidat peut retirer son consentement à tout moment.
export const candidateRouter = express.Router();

// 'open' : lien encore valable. 'any' : toujours possible (consultation, retrait du consentement).
// 'device' : association d'appareil, possible juste après la vérification du visage.
// 'flash' : test du reflet de l'écran, dans la même fenêtre après la vérification du visage (le lien reste à usage unique).
type Mode = 'open' | 'any' | 'device' | 'flash';
const DEVICE_GRACE_MS = 10 * 60 * 1000;

function link(mode: Mode) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = getSessionByCandidateToken(req.params.token);
    if (!session) return res.status(404).json({ error: 'lien inconnu' });
    const status = linkStatus(session);
    const usedAt = session.candidateLink?.usedAt ?? 0;
    const deviceWindow =
      (mode === 'device' || mode === 'flash') &&
      status === 'used' &&
      Date.now() - usedAt < DEVICE_GRACE_MS &&
      !session.consent?.withdrawnAt;
    if (mode !== 'any' && status !== 'open' && !deviceWindow) {
      return res.status(410).json({ error: status === 'expired' ? 'lien expiré' : 'lien déjà utilisé' });
    }
    res.locals.session = session;
    next();
  };
}

const sessionOf = (res: Response) => res.locals.session as Session;

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ce que la page du candidat a besoin de savoir (jamais les signaux ni le score).
candidateRouter.get('/api/check/:token', link('any'), (_req, res) => {
  const session = sessionOf(res);
  const info: CandidateLinkInfo = {
    candidateFirstName: session.candidateLabel.split(' ')[0] || undefined,
    schedule: session.schedule,
    status: linkStatus(session),
    expiresAt: session.candidateLink!.expiresAt,
    controller: session.controller,
    biometricRetentionHours: Math.round(retention.biometricTtlMs / 3_600_000),
    consentVersion: CONSENT_VERSION,
    identityDone: Boolean(session.identity),
    faceDone: Boolean(session.faceId?.completedAt),
    flashDone: Boolean(session.screenFlash?.final),
    optedOut: Boolean(session.biometricOptOut),
    withdrawn: Boolean(session.consent?.withdrawnAt),
    deviceBound: Boolean(session.device),
  };
  res.json(info);
});

// Page 1 : identité, informations écrites et accord pour leur vérification. Rien de trouvé = aucun effet sur le score.
candidateRouter.post('/api/check/:token/identity', link('open'), async (req, res) => {
  const session = sessionOf(res);
  const payload = req.body as IdentityPayload;
  if (payload?.consent !== true) return res.status(400).json({ error: 'consentement requis' });
  const identity = sanitizeIdentity(payload);
  if (!identity) return res.status(400).json({ error: 'nom et prénom requis' });

  session.identity = { ...identity, consentAt: Date.now() };
  session.consent = { ...session.consent, infoAt: Date.now(), version: CONSENT_VERSION };
  session.candidateLabel = `${identity.firstName} ${identity.lastName}`;
  const [presence, declared] = await Promise.all([
    lookupWebPresence(identity.firstName, identity.lastName),
    declaredInfoSignals(identity),
  ]);
  // Une nouvelle saisie remplace la précédente (correction d'une faute de frappe).
  session.signals = session.signals.filter((s) => s.source !== 'identity');
  upsertSignals(session, [presence, ...declared]);
  audit(session, 'candidat', 'Informations déclarées', 'accord pour leur vérification dans des sources publiques');
  schedulePersist();
  res.json({ checked: true });
});

// Environnement (caméras, fuseau horaire, IP), relevé au lancement de la caméra.
candidateRouter.post('/api/check/:token/precheck', link('open'), (req, res) => {
  const session = sessionOf(res);
  const signals = precheckSignals(req.body as PrecheckPayload, req.ip ?? 'inconnue');
  upsertSignals(session, signals);
  session.precheckDone = true;
  schedulePersist();
  res.json({ signals: signals.map(({ label, status, detail }) => ({ label, status, detail })) });
});

// Page 2 : consentement biométrique explicite (exigé ici, avant toute capture), puis séquence tirée au hasard.
// Parcours durci si un signal à vérifier existe déjà ; seule la caméra de l'appareil est acceptée.
candidateRouter.post('/api/check/:token/faceid/start', link('open'), (req, res) => {
  const session = sessionOf(res);
  const body = (req.body ?? {}) as { cameraLabel?: string; biometricConsent?: boolean };
  if (body.biometricConsent !== true) return res.status(400).json({ error: 'consentement biométrique requis' });
  if (!session.identity) return res.status(409).json({ error: 'informations à remplir avant la caméra' });
  if (session.faceId?.completedAt) return res.status(409).json({ error: 'pré-vérification déjà terminée' });

  if (!session.consent?.biometricAt) {
    session.consent = { ...session.consent, biometricAt: Date.now(), version: CONSENT_VERSION };
    audit(session, 'candidat', 'Consentement biométrique donné', `texte version ${CONSENT_VERSION}`);
  }

  const cameraLabel = String(body.cameraLabel ?? '').slice(0, 120);
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

// Fin du parcours : résultats des étapes et gabarit (empreinte + proportions), calculés dans le navigateur.
candidateRouter.post('/api/check/:token/faceid/submit', link('open'), (req, res) => {
  const session = sessionOf(res);
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
    const embedding = isValidEmbedding(body.embedding) ? meanEmbedding([body.embedding]) : undefined;
    setFaceProfile(session, { ratios: body.ratios, samples: body.samples, angles, embedding, createdAt: Date.now() });
    audit(
      session,
      'système',
      'Gabarit biométrique créé',
      `${embedding ? 'empreinte et ' : ''}proportions de face${angles.length ? ` et sous ${angles.length} angle(s)` : ''} ; ` +
        `supprimé à la décision, au plus tard dans ${Math.round(retention.biometricTtlMs / 3_600_000)} h`,
    );
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
  audit(
    session,
    'système',
    'Vérification du visage terminée',
    body.results.map((r) => `${r.step} : ${r.result}`).join(', '),
  );
  markLinkUsed(session);
  schedulePersist();
  res.json({
    profileStored: Boolean(getFaceProfile(session)),
    steps: body.results.map((r) => ({ step: r.step, result: r.result })),
  });
});

// Alternative sans biométrie : aucune caméra, aucun gabarit, et aucune pénalité. Le recruteur vérifie lui-même.
// Créneau : le candidat confirme le créneau proposé, ou en propose un autre (le recruteur est prévenu sur son dashboard).
candidateRouter.post('/api/check/:token/schedule', link('any'), (req, res) => {
  const session = sessionOf(res);
  if (!session.schedule) return res.status(409).json({ error: 'aucun créneau proposé' });
  const body = (req.body ?? {}) as { confirm?: boolean; proposeAt?: number; message?: string };
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 300) : undefined;
  if (body.confirm) {
    session.schedule.response = { kind: 'confirmed', at: Date.now(), slot: session.schedule.at, message };
    audit(session, 'candidat', 'Créneau confirmé', new Date(session.schedule.at).toISOString());
  } else {
    const slot = Number(body.proposeAt);
    if (!Number.isFinite(slot) || slot < Date.now()) return res.status(400).json({ error: 'créneau invalide' });
    session.schedule.response = { kind: 'proposed', at: Date.now(), slot, message };
    audit(session, 'candidat', 'Autre créneau proposé', new Date(slot).toISOString());
  }
  schedulePersist();
  res.json({ schedule: session.schedule });
});

candidateRouter.post('/api/check/:token/optout', link('open'), (_req, res) => {
  const session = sessionOf(res);
  session.biometricOptOut = { at: Date.now() };
  upsertSignals(session, [
    {
      id: 'face.optout',
      source: 'face',
      severity: 'medium',
      at: Date.now(),
      status: 'unknown',
      label: 'Vérification sans biométrie choisie',
      detail:
        "Le candidat a préféré ne pas faire la vérification du visage : c'est son droit, sans effet sur le score. " +
        "Prévoyez une vérification humaine pendant l'entretien (défis en direct, questions).",
    },
  ]);
  audit(session, 'candidat', 'Vérification sans biométrie choisie');
  markLinkUsed(session);
  schedulePersist();
  res.json({ optedOut: true });
});

// Retrait du consentement : toujours possible, même après l'utilisation ou l'expiration du lien.
candidateRouter.post('/api/check/:token/withdraw', link('any'), (_req, res) => {
  const session = sessionOf(res);
  if (!session.consent?.withdrawnAt) {
    session.consent = { ...session.consent, withdrawnAt: Date.now() };
    audit(session, 'candidat', 'Consentement biométrique retiré');
  }
  purgeBiometrics(session, 'retrait du consentement', 'candidat');
  delete session.device;
  upsertSignals(session, [
    {
      id: 'face.withdrawn',
      source: 'face',
      severity: 'medium',
      at: Date.now(),
      status: 'unknown',
      label: 'Consentement biométrique retiré',
      detail:
        "Le candidat a retiré son consentement : son gabarit est supprimé, plus aucune comparaison du visage. " +
        'Sans effet sur le score ; prévoyez une vérification humaine.',
    },
  ]);
  schedulePersist();
  res.json({ withdrawn: true });
});

// Test du reflet de l'écran (après la vérification du visage). L'analyse se fait dans le navigateur du candidat ;
// le serveur reçoit seulement le résumé de chaque essai, puis « terminé ». Un test interrompu reste sans effet.
// Autorisé dans la fenêtre qui suit le Face ID (le lien est déjà marqué utilisé) : mêmes règles que l'ancienne route.
candidateRouter.post('/api/check/:token/flash', link('flash'), (req, res) => {
  const session = sessionOf(res);
  if (!session.identity) return res.status(409).json({ error: 'consentement requis avant la caméra' });
  if (!session.faceId?.completedAt) return res.status(409).json({ error: 'vérification du visage à terminer d’abord' });
  if (session.screenFlash?.final) return res.status(409).json({ error: 'test du reflet déjà terminé' });

  const body = (req.body ?? {}) as Partial<FlashSubmission>;
  const attempt = body.attempt === undefined ? null : sanitizeFlashAttempt(body.attempt);
  if (body.attempt !== undefined && !attempt) return res.status(400).json({ error: 'essai invalide' });

  const previous = session.screenFlash?.attempts ?? [];
  // « Passer » n'est possible qu'avant le premier essai : un essai déjà fait reste dans le rapport.
  const skipped = body.skipped === true && !attempt && previous.length === 0;
  if (body.skipped === true && !skipped) return res.status(409).json({ error: 'un essai a déjà été fait' });
  const attempts = attempt ? [...previous, attempt] : previous;
  if (attempts.length > FLASH_MAX_ATTEMPTS) return res.status(409).json({ error: 'nombre d’essais dépassé' });

  const final = body.final === true || skipped || attempts.length === FLASH_MAX_ATTEMPTS;
  session.screenFlash = { attempts, final, skipped, at: Date.now() };
  upsertSignals(session, [
    { id: 'precheck.screen-flash', source: 'precheck', at: Date.now(), ...describeFlash(session.screenFlash) },
  ]);
  audit(session, 'candidat', skipped ? 'Test du reflet de l’écran passé' : 'Test du reflet de l’écran : essai enregistré', `essais : ${attempts.length}${final ? ', terminé' : ''}`);
  schedulePersist();
  // Le candidat apprend seulement que c'est enregistré : le verdict est pour le recruteur.
  res.json({ recorded: true, final });
});

// Association de l'appareil (clé d'accès), facultative, juste après la vérification du visage.
candidateRouter.post('/api/check/:token/device/options', link('device'), async (req, res) => {
  res.json(await registrationOptions(req, sessionOf(res)));
});

candidateRouter.post('/api/check/:token/device', link('device'), async (req, res) => {
  const session = sessionOf(res);
  const ok = await verifyRegistration(req, session, req.body);
  if (!ok) return res.status(400).json({ error: "l'appareil n'a pas pu être associé" });
  upsertSignals(session, [
    {
      id: 'device.bound',
      source: 'device',
      severity: 'medium',
      at: Date.now(),
      status: 'ok',
      label: 'Appareil associé à la pré-vérification',
      detail: "Une clé d'accès a été créée sur l'appareil du candidat : vous pourrez lui demander de la confirmer en visio.",
    },
  ]);
  audit(session, 'candidat', 'Appareil associé (clé d’accès)');
  res.json({ bound: true });
});
