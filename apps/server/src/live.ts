import express from 'express';
import {
  combineContinuity,
  cosine,
  findVirtualCameras,
  isProbability,
  isValidEmbedding,
  isValidRatios,
  judgeContinuity,
  judgeIdentity,
  median,
  ratioDistance,
  referenceFor,
  type LiveSample,
  type Session,
} from '@kyc/shared';
import { audit } from './audit.ts';
import { recruiterOnly } from './auth.ts';
import { thresholds } from './config.ts';
import { getFaceProfile, getSession, schedulePersist, upsertSignals } from './store.ts';

// Pendant l'entretien : la personne est-elle la même qu'à la pré-vérification ?
// Deux contrôles indépendants, calculés dans le navigateur du recruteur : l'empreinte faciale et les proportions du
// visage. Le serveur ne reçoit que ces nombres ; il garde en mémoire les similarités, jamais les empreintes reçues.
export const liveRouter = express.Router();

const similarities = new Map<string, number[]>();
const geometry = new Map<string, number[]>();
const lastVerdict = new Map<string, string>();

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
  // Journal : seulement les changements de verdict, avec les scores (jamais les empreintes).
  if (verdict !== 'unknown' && lastVerdict.get(session.id) !== verdict) {
    lastVerdict.set(session.id, verdict);
    audit(
      session,
      'système',
      'Comparaison du visage',
      `${verdict === 'different' ? 'non-correspondance' : 'correspondance'} ; ${parts.join(' ; ')}`,
    );
  }
  return verdict;
}

// Le panneau recruteur envoie, toutes les 2 s et pendant les défis, des mesures du visage affiché calculées dans son
// navigateur : proportions (comparées au profil de face ou sous l'angle le plus proche), empreinte, probabilité de
// trucage. Aucune image n'est acceptée ici.
liveRouter.post('/api/sessions/:id/live-sample', recruiterOnly, (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: "mesures uniquement, jamais d'image" });
  const session = getSession(req.params.id)!;
  const { ratios, yawDeg, embedding, fakeProbability } = (req.body ?? {}) as LiveSample;
  if (isProbability(fakeProbability)) session.passiveScores = [...(session.passiveScores ?? []), fakeProbability].slice(-15);

  // Pas de gabarit (vérification sans biométrie, consentement retiré, gabarit supprimé) : aucune comparaison.
  const profile = getFaceProfile(session);
  if (!profile) return res.json({ verdict: 'unknown', reason: 'pas de profil' });
  if (isValidEmbedding(embedding) && profile.embedding) push(similarities, session.id, cosine(profile.embedding, embedding));
  if (isValidRatios(ratios) && Number.isFinite(yawDeg)) {
    const reference = referenceFor(profile, yawDeg!);
    if (reference) push(geometry, session.id, ratioDistance(reference, ratios));
  }
  res.json({ verdict: updateContinuity(session) });
});

// Visio de secours : la page du candidat indique la caméra réellement utilisée.
liveRouter.post('/api/sessions/:id/live-camera', (req, res) => {
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
