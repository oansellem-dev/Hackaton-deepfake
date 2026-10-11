// Contrat partagé entre le serveur, le site web et l'extension.

import type { FaceIdPlan } from './face.ts';
import type { FlashSummary } from './flash.ts';

export type Severity = 'strong' | 'medium';

// Règle n°1 : seul « contradiction » fait baisser le score.
// « unknown » (absence de trace, signal non vérifiable) n'a aucun effet.
export type SignalStatus = 'ok' | 'contradiction' | 'unknown';

export type SignalSource = 'precheck' | 'challenge' | 'cv' | 'identity' | 'face' | 'device';

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
// Valeurs communes à Oval et au moteur : poursuivre le recrutement, refaire un défi au prochain échange,
// proposer un entretien en présentiel.
export type Decision = 'poursuivre' | 'refaire_defi' | 'presentiel';

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

// Version du texte de consentement biométrique affiché au candidat (à changer à chaque modification du texte).
export const CONSENT_VERSION = '2026-10-11';

// Responsable du traitement : l'entreprise qui recrute, renseignée par le recruteur à la création de l'entretien.
export interface Controller {
  name: string;
  contact: string; // adresse à laquelle le candidat exerce ses droits
}

// Lien de pré-vérification : jeton non devinable, expiration courte, usage unique.
export interface CandidateLink {
  token: string;
  expiresAt: number;
  usedAt?: number;
}

// Trace du consentement, horodatée, sans aucune donnée biométrique.
export interface ConsentRecord {
  infoAt?: number; // vérification des informations déclarées
  biometricAt?: number; // traitement biométrique (article 9 RGPD), donné sur l'écran de la caméra
  version?: string; // version du texte affiché
  withdrawnAt?: number; // retrait par le candidat : gabarit supprimé, plus aucune comparaison
}

// Journal d'audit : qui a fait quoi, quand, avec quel résultat. Jamais de donnée biométrique.
export interface AuditEntry {
  at: number;
  actor: 'candidat' | 'recruteur' | 'système';
  action: string;
  detail?: string;
}

// Clé d'accès (passkey) créée à la pré-vérification : prouve ensuite qu'on parle au même appareil.
// Ce n'est pas une donnée biométrique : l'empreinte digitale ou le visage restent dans l'appareil.
export interface DeviceBinding {
  credentialId: string;
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  registeredAt: number;
}

export interface Session {
  id: string;
  createdAt: number;
  candidateLabel: string;
  precheckDone: boolean;
  controller?: Controller;
  candidateLink?: CandidateLink;
  consent?: ConsentRecord;
  biometricOptOut?: { at: number }; // vérification sans biométrie choisie par le candidat
  identity?: DeclaredIdentity;
  faceId?: FaceIdPlan & { startedAt: number; completedAt?: number };
  // Gabarit biométrique : stocké à part (templates.json), chiffré, sous un identifiant aléatoire sans lien avec
  // l'identité ; jamais renvoyé au client, effacé à la décision, au retrait ou à expiration (serveur seulement).
  templateId?: string;
  device?: DeviceBinding; // serveur seulement
  deviceChallenge?: string; // serveur seulement
  presence?: { token: string; expiresAt: number; challenge?: string }; // serveur seulement
  audit?: AuditEntry[];
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

export interface SessionView
  extends Omit<Session, 'recruiterKey' | 'templateId' | 'device' | 'deviceChallenge' | 'presence'> {
  score: Score;
  hasFaceProfile: boolean;
  deviceBound: boolean;
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

// Ce que la page du candidat apprend de son lien (jamais les signaux ni le score).
export interface CandidateLinkInfo {
  status: 'open' | 'used' | 'expired';
  expiresAt: number;
  controller?: Controller;
  biometricRetentionHours: number;
  consentVersion: string;
  identityDone: boolean;
  faceDone: boolean;
  flashDone: boolean; // test du reflet terminé ou passé
  optedOut: boolean;
  withdrawn: boolean;
  deviceBound: boolean;
}
