import type { Score, Severity, Signal } from './types.ts';

// Poids de départ, à ajuster après les 20 tests.
export const WEIGHTS: Record<Severity, number> = {
  strong: 35,
  medium: 15,
};

export function computeScore(signals: Signal[]): Score {
  const contradictions = signals
    .filter((s) => s.status === 'contradiction')
    .sort((a, b) => WEIGHTS[b.severity] - WEIGHTS[a.severity]);

  // Règle n°1 : l'absence de trace ne baisse jamais le score.
  const penalty = contradictions.reduce((sum, s) => sum + WEIGHTS[s.severity], 0);
  const value = Math.max(0, 100 - penalty);
  const level = value >= 80 ? 'green' : value >= 50 ? 'orange' : 'red';

  const unknownCount = signals.filter((s) => s.status === 'unknown').length;

  // Lignes déterministes. Le modèle de langage (brique D) pourra les reformuler,
  // mais à partir de ces signaux uniquement, sans rien inventer.
  const explanation =
    contradictions.length === 0
      ? ['Aucune contradiction relevée pour le moment.']
      : contradictions.slice(0, 3).map((s) => `Signal à vérifier : ${s.label}. ${s.detail}`);

  if (explanation.length < 3 && unknownCount > 0) {
    explanation.push(
      unknownCount > 1
        ? `${unknownCount} signaux non vérifiables, sans effet sur le score.`
        : '1 signal non vérifiable, sans effet sur le score.',
    );
  }

  return { value, level, explanation };
}
