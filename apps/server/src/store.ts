import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeScore,
  type AuditEntry,
  type Controller,
  type FaceProfile,
  type Session,
  type SessionView,
  type Signal,
  type Schedule,
} from '@kyc/shared';
import { audit } from './audit.ts';
import { DATA_DIR, unseal } from './biometric.ts';
import { retention } from './config.ts';
import { deleteTemplate, expiredTemplateIds, getTemplate, hasTemplate, putTemplate } from './templates.ts';

// Fiches d'entretien : identité déclarée, signaux, défis, décision, journal. Aucune image, et aucun gabarit
// biométrique : il est rangé à part (templates.ts), la fiche ne garde que son identifiant aléatoire.
const FILE = join(DATA_DIR, 'sessions.json');

const sessions = new Map<string, Session>();
const byCandidateToken = new Map<string, string>();
const byPresenceToken = new Map<string, string>();

const newToken = (bytes: number) => randomBytes(bytes).toString('base64url');

type Stored = Session & { faceProfileSealed?: string }; // ancien format : gabarit chiffré dans la fiche

function index(session: Session): void {
  if (session.candidateLink) byCandidateToken.set(session.candidateLink.token, session.id);
  if (session.presence) byPresenceToken.set(session.presence.token, session.id);
}

function load(): void {
  if (!existsSync(FILE)) return;
  try {
    let migrated = false;
    for (const { faceProfileSealed, ...session } of JSON.parse(readFileSync(FILE, 'utf8')) as Stored[]) {
      // Ancien format : on déplace le gabarit dans le stockage séparé, pour la durée qui lui reste.
      if (faceProfileSealed) {
        const profile = unseal(faceProfileSealed);
        const left = profile ? retention.biometricTtlMs - (Date.now() - profile.createdAt) : 0;
        if (profile && left > 0) session.templateId = putTemplate(profile, left);
        migrated = true;
      }
      // Entretiens créés avant les jetons : on leur en donne un (lisible dans le fichier par l'hôte).
      if (!session.recruiterKey) {
        session.recruiterKey = newToken(18);
        migrated = true;
      }
      sessions.set(session.id, session);
      index(session);
    }
    if (migrated) schedulePersist();
  } catch (err) {
    console.warn('Sessions existantes illisibles, démarrage à vide :', String(err));
  }
}

let timer: NodeJS.Timeout | undefined;
export function schedulePersist(): void {
  clearTimeout(timer);
  timer = setTimeout(persistNow, 300);
}

export function persistNow(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify([...sessions.values()]));
}

// --- Gabarit biométrique de l'entretien (stocké à part) ---

export function setFaceProfile(session: Session, profile: FaceProfile): void {
  deleteTemplate(session.templateId);
  session.templateId = putTemplate(profile, retention.biometricTtlMs);
  schedulePersist();
}

export function getFaceProfile(session: Session): FaceProfile | undefined {
  return getTemplate(session.templateId);
}

export type PurgeReason =
  | 'décision du recruteur'
  | 'suppression manuelle'
  | 'retrait du consentement'
  | 'durée maximale atteinte';

export function purgeBiometrics(session: Session, reason: PurgeReason, actor: AuditEntry['actor']): boolean {
  if (!session.templateId) return false;
  deleteTemplate(session.templateId);
  delete session.templateId;
  audit(session, actor, 'Gabarit biométrique supprimé', reason);
  schedulePersist();
  return true;
}

// Tâche planifiée : supprime les gabarits expirés, filet de sécurité si l'entretien n'est jamais clos.
export function sweepExpiredBiometrics(now = Date.now()): void {
  const expired = new Set(expiredTemplateIds(now));
  for (const s of sessions.values()) {
    if (s.templateId && (expired.has(s.templateId) || !hasTemplate(s.templateId))) {
      purgeBiometrics(s, 'durée maximale atteinte', 'système');
    }
  }
  for (const id of expired) deleteTemplate(id); // gabarits sans entretien
}

load();
sweepExpiredBiometrics();
setInterval(sweepExpiredBiometrics, retention.sweepMs).unref();

// --- Entretiens et liens ---

export function createSession(candidateLabel: string, controller?: Controller, schedule?: Schedule, candidateEmail?: string): Session {
  const session: Session = {
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    candidateLabel,
    precheckDone: false,
    signals: [],
    challenges: [],
    recruiterKey: newToken(18),
    // Lien de pré-vérification : jeton de 32 caractères, valable peu de temps, utilisable une seule fois.
    candidateLink: { token: newToken(24), expiresAt: Date.now() + retention.candidateLinkTtlMs },
    ...(controller ? { controller } : {}),
    ...(schedule ? { schedule } : {}),
    ...(candidateEmail ? { candidateEmail } : {}),
  };
  sessions.set(session.id, session);
  index(session);
  audit(session, 'recruteur', 'Entretien créé', controller ? `Responsable du traitement : ${controller.name}` : undefined);
  schedulePersist();
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getSessionByCandidateToken(token: string): Session | undefined {
  const id = byCandidateToken.get(token);
  return id ? sessions.get(id) : undefined;
}

export function linkStatus(session: Session, now = Date.now()): 'open' | 'used' | 'expired' {
  const link = session.candidateLink;
  if (!link) return 'expired';
  if (link.usedAt) return 'used';
  return now > link.expiresAt ? 'expired' : 'open';
}

export function markLinkUsed(session: Session): void {
  if (session.candidateLink && !session.candidateLink.usedAt) {
    session.candidateLink.usedAt = Date.now();
    audit(session, 'système', 'Lien de pré-vérification utilisé', 'il ne peut plus servir');
  }
}

export function createPresence(session: Session): string {
  if (session.presence) byPresenceToken.delete(session.presence.token);
  session.presence = { token: newToken(24), expiresAt: Date.now() + retention.presenceTtlMs };
  index(session);
  schedulePersist();
  return session.presence.token;
}

export function getSessionByPresenceToken(token: string): Session | undefined {
  const id = byPresenceToken.get(token);
  const session = id ? sessions.get(id) : undefined;
  return session?.presence?.token === token ? session : undefined;
}

export function clearPresence(session: Session): void {
  if (session.presence) byPresenceToken.delete(session.presence.token);
  delete session.presence;
  schedulePersist();
}

// Vue du recruteur : jamais le gabarit, ni le jeton, ni les clés d'appareil ; seulement leur présence.
export function stripBiometrics(session: Session): Omit<SessionView, 'score'> {
  const { recruiterKey, templateId, device, deviceChallenge, presence, ...rest } = session;
  const profile = getTemplate(templateId);
  return {
    ...rest,
    hasFaceProfile: Boolean(profile),
    faceProfileSummary: profile
      ? { samples: profile.samples, angles: profile.angles?.length ?? 0, embedding: Boolean(profile.embedding) }
      : undefined,
    deviceBound: Boolean(device),
  };
}

export function view(session: Session): SessionView {
  return { ...stripBiometrics(session), score: computeScore(session.signals) };
}

// Remplace les signaux de même id (une pré-vérification relancée écrase la précédente).
export function upsertSignals(session: Session, signals: Signal[]): void {
  const ids = new Set(signals.map((s) => s.id));
  session.signals = [...session.signals.filter((s) => !ids.has(s.id)), ...signals];
}
