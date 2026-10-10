import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditEntry, Session } from '@kyc/shared';
import { DATA_DIR } from './biometric.ts';

// Journal d'audit : qui a vérifié quoi, quand, avec quel résultat, et quelles suppressions ont eu lieu.
// Jamais de donnée biométrique : seulement des verdicts, des scores et des horodatages.
// Une copie par entretien (affichée au recruteur) et un fichier en ajout seul (data/audit.jsonl).
const FILE = join(DATA_DIR, 'audit.jsonl');

export function audit(session: Session, actor: AuditEntry['actor'], action: string, detail?: string): void {
  const entry: AuditEntry = { at: Date.now(), actor, action, ...(detail ? { detail } : {}) };
  (session.audit ??= []).push(entry);
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    appendFileSync(FILE, `${JSON.stringify({ session: session.id, ...entry })}\n`);
  } catch {
    // le journal de l'entretien reste disponible même si le fichier ne peut pas être écrit
  }
}
