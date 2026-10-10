import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import express, { type Request } from 'express';
import type { Session } from '@kyc/shared';
import { audit } from './audit.ts';
import { recruiterOnly } from './auth.ts';
import {
  clearPresence,
  createPresence,
  getSession,
  getSessionByPresenceToken,
  schedulePersist,
  upsertSignals,
} from './store.ts';

// Liaison d'appareil (WebAuthn) : une clé d'accès créée à la pré-vérification, puis demandée pendant l'entretien
// (lien collé dans la discussion de la visio). Elle prouve qu'on parle au même appareil, sans aucune biométrie
// côté serveur : l'empreinte digitale ou le visage déverrouillent la clé dans l'appareil et n'en sortent jamais.

// Domaine et origine de la page qui appelle (fonctionne en local, derrière un tunnel ou un proxy TLS).
function relyingParty(req: Request) {
  const host = req.get('x-forwarded-host') ?? req.get('host') ?? 'localhost';
  return { rpID: host.split(':')[0], origin: `${req.protocol}://${host}` };
}

export async function registrationOptions(req: Request, session: Session) {
  const { rpID } = relyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: 'KYC Visio',
    rpID,
    // Aucun nom réel : la clé est rangée dans l'appareil sous une étiquette d'entretien.
    userName: `entretien-${session.id}`,
    userDisplayName: `Entretien ${session.controller?.name ?? ''}`.trim(),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    timeout: 120_000,
  });
  session.deviceChallenge = options.challenge;
  schedulePersist();
  return options;
}

export async function verifyRegistration(req: Request, session: Session, response: unknown): Promise<boolean> {
  if (!session.deviceChallenge) return false;
  const { rpID, origin } = relyingParty(req);
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
      expectedChallenge: session.deviceChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!verified) return false;
    const { credential } = registrationInfo;
    session.device = {
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports,
      registeredAt: Date.now(),
    };
    return true;
  } catch {
    return false;
  } finally {
    delete session.deviceChallenge;
    schedulePersist();
  }
}

export const presenceRouter = express.Router();

// Le recruteur demande une confirmation : un lien à usage unique, valable 10 minutes, à coller dans la visio.
presenceRouter.post('/api/sessions/:id/presence', recruiterOnly, (req, res) => {
  const session = getSession(req.params.id)!;
  if (!session.device) return res.status(409).json({ error: "aucun appareil associé à la pré-vérification" });
  const token = createPresence(session);
  audit(session, 'recruteur', "Confirmation d'appareil demandée");
  res.json({ path: `/presence/${token}`, expiresAt: session.presence!.expiresAt });
});

function openPresence(token: string) {
  const session = getSessionByPresenceToken(token);
  return session && session.presence && session.presence.expiresAt > Date.now() && session.device ? session : undefined;
}

presenceRouter.get('/api/presence/:token', (req, res) => {
  const session = openPresence(req.params.token);
  if (!session) return res.status(410).json({ error: 'lien expiré ou déjà utilisé' });
  res.json({ controller: session.controller?.name ?? null });
});

presenceRouter.post('/api/presence/:token/options', async (req, res) => {
  const session = openPresence(req.params.token);
  if (!session) return res.status(410).json({ error: 'lien expiré ou déjà utilisé' });
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [{ id: session.device!.credentialId, transports: session.device!.transports }],
    userVerification: 'preferred',
    timeout: 120_000,
  });
  session.presence!.challenge = options.challenge;
  schedulePersist();
  res.json(options);
});

presenceRouter.post('/api/presence/:token', async (req, res) => {
  const session = openPresence(req.params.token);
  if (!session?.presence?.challenge) return res.status(410).json({ error: 'lien expiré ou déjà utilisé' });
  const { rpID, origin } = relyingParty(req);
  const device = session.device!;
  let verified = false;
  try {
    const result = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: session.presence.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: device.credentialId,
        publicKey: isoBase64URL.toBuffer(device.publicKey),
        counter: device.counter,
        transports: device.transports,
      },
      requireUserVerification: false,
    });
    verified = result.verified;
    if (verified) device.counter = result.authenticationInfo.newCounter;
  } catch {
    verified = false;
  }
  clearPresence(session);
  upsertSignals(session, [
    {
      id: 'device.presence',
      source: 'device',
      severity: 'medium',
      at: Date.now(),
      status: verified ? 'ok' : 'contradiction',
      label: verified ? 'Appareil confirmé pendant l’entretien' : 'Confirmation d’appareil échouée',
      detail: verified
        ? 'La clé d’accès créée à la pré-vérification a été utilisée : même appareil.'
        : 'La clé d’accès de la pré-vérification n’a pas été présentée : autre appareil possible, à vérifier simplement.',
    },
  ]);
  audit(session, 'candidat', "Confirmation d'appareil", verified ? 'réussie' : 'échouée');
  res.json({ verified });
});
