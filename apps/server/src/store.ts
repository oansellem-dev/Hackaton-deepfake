import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeScore, type Session, type SessionView, type Signal } from '@kyc/shared';
import { DATA_DIR, seal, unseal } from './biometric.ts';

// Aucune image ni vidéo n'est conservée : seulement les signaux, les résultats de défis, la décision du recruteur
// et, avec le consentement du candidat, les proportions de son visage (chiffrées, effacées à la décision).
const FILE = join(DATA_DIR, 'sessions.json');
export const BIOMETRIC_MAX_AGE_MS = 24 * 3600 * 1000;

const sessions = new Map<string, Session>();

const newRecruiterKey = () => randomBytes(18).toString('base64url');

type Stored = Omit<Session, 'faceProfile'> & { faceProfileSealed?: string };

function load(): void {
  if (!existsSync(FILE)) return;
  try {
    for (const { faceProfileSealed, ...rest } of JSON.parse(readFileSync(FILE, 'utf8')) as Stored[]) {
      const session: Session = rest;
      if (faceProfileSealed) session.faceProfile = unseal(faceProfileSealed);
      // Entretiens créés avant les jetons : on leur en donne un (lisible dans le fichier par l'hôte).
      session.recruiterKey ??= newRecruiterKey();
      sessions.set(session.id, session);
    }
    purgeExpiredBiometrics();
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
  const out: Stored[] = [...sessions.values()].map(({ faceProfile, ...rest }) => ({
    ...rest,
    ...(faceProfile ? { faceProfileSealed: seal(faceProfile) } : {}),
  }));
  writeFileSync(FILE, JSON.stringify(out));
}

export function purgeBiometrics(session: Session): void {
  delete session.faceProfile;
  schedulePersist();
}

export function purgeExpiredBiometrics(now = Date.now()): void {
  for (const s of sessions.values()) {
    if (s.faceProfile && now - s.faceProfile.createdAt > BIOMETRIC_MAX_AGE_MS) purgeBiometrics(s);
  }
}

load();
setInterval(purgeExpiredBiometrics, 10 * 60 * 1000).unref();

export function createSession(candidateLabel: string): Session {
  const session: Session = {
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    candidateLabel,
    precheckDone: false,
    signals: [],
    challenges: [],
    recruiterKey: newRecruiterKey(),
  };
  sessions.set(session.id, session);
  schedulePersist();
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

// Le profil du visage et le jeton du recruteur ne quittent jamais le serveur : la vue n'indique que leur présence.
export function stripBiometrics(session: Session): Omit<SessionView, 'score'> {
  const { faceProfile, recruiterKey, ...rest } = session;
  return {
    ...rest,
    hasFaceProfile: Boolean(faceProfile),
    faceProfileSummary: faceProfile
      ? { samples: faceProfile.samples, angles: faceProfile.angles?.length ?? 0, embedding: Boolean(faceProfile.embedding) }
      : undefined,
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
