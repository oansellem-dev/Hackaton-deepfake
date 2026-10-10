import { randomUUID } from 'node:crypto';
import { computeScore, type Session, type SessionView, type Signal } from '@kyc/shared';

// Stockage en mémoire : suffisant pour le PoC. Aucune image ni vidéo n'est conservée,
// seulement les signaux, les résultats de défis et la décision du recruteur.
const sessions = new Map<string, Session>();

export function createSession(candidateLabel: string): Session {
  const session: Session = {
    id: randomUUID().slice(0, 8),
    createdAt: Date.now(),
    candidateLabel,
    precheckDone: false,
    signals: [],
    challenges: [],
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function view(session: Session): SessionView {
  return { ...session, score: computeScore(session.signals) };
}

// Remplace les signaux de même id (une pré-vérification relancée écrase la précédente).
export function upsertSignals(session: Session, signals: Signal[]): void {
  const ids = new Set(signals.map((s) => s.id));
  session.signals = [...session.signals.filter((s) => !ids.has(s.id)), ...signals];
}
