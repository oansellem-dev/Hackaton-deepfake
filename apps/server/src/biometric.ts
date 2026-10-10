import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FaceProfile } from '@kyc/shared';

// Les proportions du visage sont une donnée biométrique : elles sont chiffrées (AES-256-GCM) avant d'être écrites sur disque.
// Clé : variable BIOMETRIC_KEY (64 caractères hexadécimaux), sinon un fichier de clé local créé au premier lancement.
export const DATA_DIR = process.env.KYC_DATA_DIR ?? fileURLToPath(new URL('../data', import.meta.url));

function getKey(): Buffer {
  const fromEnv = process.env.BIOMETRIC_KEY;
  if (fromEnv) {
    if (!/^[0-9a-f]{64}$/i.test(fromEnv)) throw new Error('BIOMETRIC_KEY doit faire 64 caractères hexadécimaux');
    return Buffer.from(fromEnv, 'hex');
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const file = join(DATA_DIR, 'biometric.key');
  if (!existsSync(file)) {
    writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      /* Windows : les droits POSIX ne s'appliquent pas */
    }
  }
  return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
}

let key: Buffer | undefined;

export function seal(profile: FaceProfile): string {
  key ??= getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(profile), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

export function unseal(sealed: string): FaceProfile | undefined {
  try {
    key ??= getKey();
    const raw = Buffer.from(sealed, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
  } catch {
    return undefined; // clé changée ou fichier altéré : le profil est considéré comme absent
  }
}
