import { getChallenge, type ChallengeResult, type Session } from '@kyc/shared';
import { upsertSignals } from './store.ts';

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
  upsertSignals(session, [
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
