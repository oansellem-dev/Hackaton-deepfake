// Contrat partagé entre le serveur, le site web et l'extension.

import type { FaceIdPlan, FaceProfile } from './face.ts';
import type { FlashSummary } from './flash.ts';

export type Severity = 'strong' | 'medium';

// Règle n°1 : seul « contradiction » fait baisser le score.
// « unknown » (absence de trace, signal non vérifiable) n'a aucun effet.
export type SignalStatus = 'ok' | 'contradiction' | 'unknown';

export type SignalSource = 'precheck' | 'challenge' | 'cv' | 'identity' | 'face';

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
  phase?: 'precheck' | 'live'; // absent = pendant l'entretien
  metrics?: Record<string, number>; // mesures brutes du détecteur, affichées au rapport, sans effet sur le score
}

// Règle n°2 : le recruteur décide, l'outil éclaire.
export type Decision = 'continue' | 'extra_check' | 'stop';

export type ScoreLevel = 'green' | 'orange' | 'red';

export interface Score {
  value: number; // 0 à 100
  level: ScoreLevel;
  explanation: string[]; // 3 lignes max
}

// Identité et informations écrites déclarées par le candidat, avec son consentement explicite (RGPD).
// Tout est facultatif sauf le nom : une information absente ne pénalise jamais.
export interface DeclaredIdentity {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  country?: string; // code ISO à 2 lettres
  city?: string;
  jobTitle?: string;
  company?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  consentAt: number;
}

export type IdentityPayload = Omit<DeclaredIdentity, 'consentAt'> & { consent: boolean };

// CV chargé par le recruteur : lu en mémoire puis oublié. On ne garde que ce qui a été comparé et les liens
// de vérification (module d'Hector) que le recruteur ouvre lui-même.
export interface CvAnalysis {
  analyzedAt: number;
  found: { emails: string[]; phones: string[]; github: string[]; linkedin: string[]; schools: string[] };
  consistent: string[]; // éléments identiques entre le CV et les déclarations
  links: { categorie: string; label: string; url: string }[];
}

export interface Session {
  id: string;
  createdAt: number;
  candidateLabel: string;
  precheckDone: boolean;
  identity?: DeclaredIdentity;
  faceId?: FaceIdPlan & { startedAt: number; completedAt?: number };
  // Proportions du visage (biométrie) : stockées chiffrées, jamais renvoyées au client, effacées à la décision.
  faceProfile?: FaceProfile;
  // Test du reflet de l'écran : résumé de chaque essai (aucune mesure image par image, aucune image).
  screenFlash?: FlashSummary;
  // Probabilités de trucage du détecteur passif sur les dernières captures (15 au plus), sans les images.
  passiveScores?: number[];
  // Jeton du recruteur (serveur seulement) : exigé pour lire les signaux, décider et enregistrer les défis.
  recruiterKey?: string;
  cv?: CvAnalysis;
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
  passive?: { frames: number; medianFakeProbability: number | null }; // détecteur passif local
}

export interface SessionView extends Omit<Session, 'faceProfile' | 'recruiterKey'> {
  score: Score;
  hasFaceProfile: boolean;
  // Ce que contient le profil, sans les valeurs (elles ne quittent jamais le serveur).
  faceProfileSummary?: { samples: number; angles: number; embedding: boolean };
  agent?: AgentInfo;
}

export interface PrecheckPayload {
  cameras: string[];
  timezone: string;
  languages: string[];
  declaredCountry: string; // code ISO à 2 lettres, ex. « FR »
}
