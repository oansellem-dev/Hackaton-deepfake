// Bibliothèque de défis : on en ajoute ici sans toucher au reste du produit.
// La mascotte ne parle qu'au recruteur et propose des phrases naturelles, jamais des ordres.

export interface Challenge {
  id: string;
  label: string;
  mascotLine: string;
  timeoutMs: number;
}

export const PHRASES = [
  'Le chat de ma voisine adore les mandarines.',
  'Il pleut souvent à Cergy le dimanche matin.',
  'Trois tasses de café sur un bureau bleu.',
  'Le train de huit heures part toujours en retard.',
];

export const CHALLENGES: Challenge[] = [
  {
    id: 'hand-over-face',
    label: 'Main devant le visage',
    mascotLine:
      "Vous pourriez lui demander de passer la main devant son visage, par exemple pour vérifier que l'image n'est pas figée.",
    timeoutMs: 8000,
  },
  {
    id: 'head-turn',
    label: 'Rotation de la tête',
    mascotLine:
      'Proposez-lui de tourner la tête à gauche puis à droite, comme pour ajuster son cadrage.',
    timeoutMs: 8000,
  },
  {
    id: 'random-phrase',
    label: 'Phrase aléatoire',
    mascotLine: 'Demandez-lui de lire à voix haute : « {phrase} »',
    timeoutMs: 10000,
  },
];

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

export function pickChallenge(doneIds: string[] = []): Challenge {
  const remaining = CHALLENGES.filter((c) => !doneIds.includes(c.id));
  const pool = remaining.length > 0 ? remaining : CHALLENGES;
  const challenge = pool[Math.floor(Math.random() * pool.length)];
  const phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  return { ...challenge, mascotLine: challenge.mascotLine.replace('{phrase}', phrase) };
}
