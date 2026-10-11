import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FaceProfile } from '@kyc/shared';
import { DATA_DIR, seal, unseal } from './biometric.ts';

// Gabarits biométriques (empreinte faciale + proportions du visage), stockés À PART des entretiens :
// - sous un identifiant aléatoire, sans nom, e-mail ni identifiant d'entretien ;
// - chiffrés au repos (AES-256-GCM, clé distincte, jamais en clair sur disque ni dans les journaux) ;
// - avec une date d'expiration (24 h par défaut) ; jamais renvoyés par l'API, jamais réutilisés ailleurs.
const FILE = join(DATA_DIR, 'templates.json');

interface Entry {
  profile: FaceProfile;
  expiresAt: number;
}

const templates = new Map<string, Entry>();

function load(): void {
  if (!existsSync(FILE)) return;
  try {
    const stored = JSON.parse(readFileSync(FILE, 'utf8')) as { id: string; sealed: string; expiresAt: number }[];
    for (const { id, sealed, expiresAt } of stored) {
      const profile = unseal(sealed);
      if (profile && expiresAt > Date.now()) templates.set(id, { profile, expiresAt });
    }
  } catch {
    // fichier illisible : on repart sans gabarit plutôt que de bloquer le service (aucun contenu journalisé)
  }
}

function persist(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  const out = [...templates.entries()].map(([id, e]) => ({ id, sealed: seal(e.profile), expiresAt: e.expiresAt }));
  writeFileSync(FILE, JSON.stringify(out));
}

load();

export function putTemplate(profile: FaceProfile, ttlMs: number): string {
  const id = randomUUID();
  templates.set(id, { profile, expiresAt: Date.now() + ttlMs });
  persist();
  return id;
}

export function getTemplate(id: string | undefined): FaceProfile | undefined {
  const entry = id ? templates.get(id) : undefined;
  return entry && entry.expiresAt > Date.now() ? entry.profile : undefined;
}

export function deleteTemplate(id: string | undefined): boolean {
  if (!id || !templates.delete(id)) return false;
  persist();
  return true;
}

// Identifiants des gabarits expirés (la tâche planifiée les supprime en mettant à jour les entretiens).
export function expiredTemplateIds(now = Date.now()): string[] {
  return [...templates.entries()].filter(([, e]) => e.expiresAt <= now).map(([id]) => id);
}

export function hasTemplate(id: string | undefined): boolean {
  return getTemplate(id) !== undefined;
}
