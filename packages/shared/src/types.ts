// Contrat partagé entre le serveur, le site web et l'extension.

export type Severity = 'strong' | 'medium';

// Règle n°1 : seul « contradiction » fait baisser le score.
// « unknown » (absence de trace, signal non vérifiable) n'a aucun effet.
export type SignalStatus = 'ok' | 'contradiction' | 'unknown';

export type SignalSource = 'precheck' | 'challenge' | 'cv';

export interface Signal {
  id: string;
  source: SignalSource;
  severity: Severity;
  status: SignalStatus;
  label: string;
  detail: string;
  at: number;
}

export type ChallengeResult = 'passed' | 'failed' | 'inconclusive';

export interface ChallengeRun {
  challengeId: string;
  result: ChallengeResult;
  durationMs: number;
  at: number;
}

// Règle n°2 : le recruteur décide, l'outil éclaire.
export type Decision = 'continue' | 'extra_check' | 'stop';

export type ScoreLevel = 'green' | 'orange' | 'red';

export interface Score {
  value: number; // 0 à 100
  level: ScoreLevel;
  explanation: string[]; // 3 lignes max
}

export interface Session {
  id: string;
  createdAt: number;
  candidateLabel: string;
  precheckDone: boolean;
  signals: Signal[];
  challenges: ChallengeRun[];
  decision?: { value: Decision; note?: string; at: number };
}

// Recommandation de l'agent de score (service Python) : prochain défi à proposer, phrase naturelle.
export interface AgentRecommendation {
  challengeId: string; // id de la bibliothèque de défis (ex. « hand-over-face »)
  phrase: string;
  rationale: string;
}

export interface AgentInfo {
  available: boolean; // false : agent injoignable, le score local (computeScore) est utilisé
  recommendations: AgentRecommendation[];
}

export interface SessionView extends Session {
  score: Score;
  agent?: AgentInfo;
}

export interface PrecheckPayload {
  cameras: string[];
  timezone: string;
  languages: string[];
  declaredCountry: string; // code ISO à 2 lettres, ex. « FR »
}
