import { getChallenge, type ChallengeResult, type Session, type Signal } from '@kyc/shared';
import { upsertSignals } from './store.ts';

// Main devant le visage : si le visage reste entièrement détecté pendant que la main le couvre, c'est qu'il est
// dessiné par-dessus l'image (face-swap en direct). Une vraie main fait disparaître le maillage du visage.
const OVERLAY_MIN_COVER_FRAMES = 6;
const OVERLAY_MIN_RATIO = 0.9;

// Mesures envoyées par le détecteur : seulement des nombres finis, 8 au plus.
export function cleanMetrics(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([k, v]) => /^[a-zA-Z]{1,32}$/.test(k) && typeof v === 'number' && Number.isFinite(v))
    .slice(0, 8) as [string, number][];
  return entries.length ? Object.fromEntries(entries.map(([k, v]) => [k, Math.round(v * 1000) / 1000])) : undefined;
}

// Enregistre le résultat d'un défi et le signal correspondant. Règle n°1 : seul « failed » fait baisser le score.
export function recordChallenge(
  session: Session,
  challengeId: string,
  result: ChallengeResult,
  durationMs: number,
  phase: 'live' | 'precheck' = 'live',
  metrics?: Record<string, number>,
): boolean {
  const challenge = getChallenge(challengeId);
  if (!challenge) return false;

  const at = Date.now();
  session.challenges.push({ challengeId, result, durationMs, at, phase, ...(metrics ? { metrics } : {}) });
  const where = phase === 'precheck' ? ' (pré-vérification)' : '';
  const extra: Signal[] = [];
  if (challengeId === 'hand-over-face' && metrics && (metrics.coverFrames ?? 0) >= OVERLAY_MIN_COVER_FRAMES && (metrics.faceUnderHandRatio ?? 0) >= OVERLAY_MIN_RATIO) {
    extra.push({
      id: `challenge.hand-overlay.${session.challenges.length}`,
      source: 'challenge',
      severity: 'strong',
      at,
      status: 'contradiction',
      label: 'Visage encore dessiné sous la main pendant le défi',
      detail: `Pendant que la main couvrait le visage, celui-ci est resté détecté sur ${Math.round(metrics.faceUnderHandRatio * 100)} % des images. Une vraie main cache le visage ; un visage superposé à l'image, lui, reste visible. À vérifier avec un second défi.`,
    });
  }
  upsertSignals(session, [
    ...extra,
    {
      id: `challenge.${challengeId}.${session.challenges.length}`,
      source: 'challenge',
      severity: 'strong',
      at,
      status: result === 'failed' ? 'contradiction' : result === 'passed' ? 'ok' : 'unknown',
      label:
        result === 'failed'
          ? `Défi « ${challenge.label} »${where} non exécuté ou image déformée`
          : `Défi « ${challenge.label} »${where}`,
      detail:
        result === 'passed'
          ? 'Exécuté correctement.'
          : result === 'failed'
            ? 'À reproposer avant de conclure.'
            : 'Résultat non concluant, sans effet sur le score.',
    },
  ]);
  return true;
}
