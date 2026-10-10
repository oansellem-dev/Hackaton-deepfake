import { getChallenge, type ChallengeResult, type Session } from '@kyc/shared';
import { upsertSignals } from './store.ts';

// Enregistre le résultat d'un défi et le signal correspondant. Règle n°1 : seul « failed » fait baisser le score.
export function recordChallenge(
  session: Session,
  challengeId: string,
  result: ChallengeResult,
  durationMs: number,
  phase: 'live' | 'precheck' = 'live',
): boolean {
  const challenge = getChallenge(challengeId);
  if (!challenge) return false;

  const at = Date.now();
  session.challenges.push({ challengeId, result, durationMs, at, phase });
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
