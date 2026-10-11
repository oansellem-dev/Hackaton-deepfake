/**
 * CONTRAT PARTAGÉ — Oval
 * ----------------------
 * Fichier de types unique. C'est le contrat entre l'interface et les deux
 * autres briques :
 *   - le moteur de défis (analyse vidéo) produit des `Defi` et des `Signal` ;
 *   - le serveur de score produit un `Score` (valeur + résumé rédigé).
 * Où brancher : `src/store/integration.ts` (rien d'autre à toucher).
 *
 * Vocabulaire imposé : jamais de verdict. « Signal à vérifier »,
 * « présence humaine vérifiée ». Jamais « identité vérifiée ».
 */

/** ISO 8601, ex. "2026-10-13T14:00:00.000Z" */
export type ISODate = string;

// ── Personnes ───────────────────────────────────────────────────────────
export interface Candidat {
  prenom: string;
  nom: string;
  email: string;
  poste: string;              // "Développeuse back-end"
  villeDeclaree?: string;
  couleur: Couleur;           // couleur de l'avatar (initiales, pas de photo)
}
export interface Recruteur { id: string; initiales: string; nom: string; couleur: Couleur }
export type Couleur = "blue" | "violet" | "green" | "gold" | "coral" | "navy" | "pink" | "teal";

// ── Résultats : jamais de verdict ───────────────────────────────────────
/** Résultat d'une vérification. "passe" = étape passée par le candidat, jamais négatif. */
export type Resultat = "coherent" | "a_verifier" | "non_concluant" | "passe" | "rien_a_signaler";

// ── Pré-vérification (lien de deux minutes envoyé avant l'entretien) ────
export type StatutPreVerif = "non_envoyee" | "envoyee" | "ouverte" | "faite" | "non_faite";
/** Lien unique envoyé par e-mail : valable une fois, jusqu'au début de l'entretien. */
export interface LienPreVerif { token: string; expireLe: ISODate; utiliseLe?: ISODate }
export interface PreVerification {
  statut: StatutPreVerif;
  envoyeeLe?: ISODate;
  ouverteLe?: ISODate;
  relanceeLe?: ISODate;
  lien?: LienPreVerif;
  /** Le candidat a préféré ne pas faire la vérification : jamais un signal négatif. */
  refuseeLe?: ISODate;
  faiteLe?: ISODate;
  /** Les quatre étapes du lien. `undefined` = pas encore faite. */
  etapes: { accord?: boolean; camera?: boolean; lumiere?: Resultat; geste?: Resultat };
  /** Signaux techniques relevés par le navigateur (brique A). */
  signaux: Signal[];
}

// ── Signaux ─────────────────────────────────────────────────────────────
export type SignalType =
  | "camera_virtuelle" | "camera_physique" | "fuseau_horaire" | "adresse_connexion" | "vpn"
  | "test_lumiere" | "image_deformee" | "defi_non_execute" | "delai_reponse" | "levres_son" | "contradiction_cv";
export type Poids = "fort" | "moyen" | "info";
export interface Signal {
  id: string;
  type: SignalType;
  poids: Poids;
  libelle: string;        // "Image déformée pendant un geste"
  explication: string;    // toujours nuancée : « ça peut venir d'une connexion instable »
  resultat: Resultat;
  source: "preverification" | "entretien";
  a: ISODate;             // horodatage
  minute?: number;        // position dans l'entretien, pour le déroulé
}

// ── Défis ───────────────────────────────────────────────────────────────
export type DefiType = "main_devant_visage" | "rotation_tete" | "phrase_aleatoire";
export type DefiResultat = "propose" | "en_cours" | "reussi" | "a_verifier" | "non_concluant" | "passe";
export interface Defi {
  id: string;
  type: DefiType;
  phrase: string;                       // ce que Manta suggère de dire, naturellement
  proposePar: "manta" | "recruteur";
  debutMin?: number;                    // minute de début dans l'entretien
  finMin?: number;
  resultat: DefiResultat;
  detail?: string;                      // "Image déformée 1,4 s"
}

// ── Score (consultatif) et décision (au recruteur) ──────────────────────
export interface Score {
  valeur: number;          // 0 à 100, consultatif
  resume: string;          // 2 à 4 phrases rédigées à partir des signaux, sans rien inventer
  calculeLe: ISODate;
}
export type DecisionValeur = "non_prise" | "poursuivre" | "refaire_defi" | "presentiel";
export interface Decision { valeur: DecisionValeur; note?: string; par?: string; le?: ISODate }

// ── Entretien ───────────────────────────────────────────────────────────
export type StatutEntretien = "a_venir" | "en_cours" | "termine";
export interface Entretien {
  id: string;
  candidat: Candidat;
  date: ISODate;
  dureeMin: number;
  statut: StatutEntretien;
  recruteurId: string;
  preVerification: PreVerification;
  defis: Defi[];
  signaux: Signal[];       // signaux relevés pendant l'entretien (brique B)
  score?: Score;           // brique D
  decision: Decision;
  creeLe: ISODate;
  /** Entretien relié au moteur (apps/server) : identifiant de session, clé recruteur, jeton du lien candidat. */
  moteur?: { sessionId: string; recruiterKey: string; lienToken?: string };
}

// ── État global du magasin ──────────────────────────────────────────────
export interface Reglages {
  dateDemo?: ISODate;              // « aujourd'hui » forcé pour la démo
  lumiere: { dureeMs: number; fonduMs: number; etapes: number };
  textesLien: { objet: string; intro: string };
  defisActifs: DefiType[];
  /** Source des données : « moteur » (serveur apps/server) ou « démo » (données d'exemple, tout en local). */
  donnees?: "demo" | "moteur";
  /** Entreprise qui recrute : responsable du traitement envoyé au moteur à la création d'un entretien. */
  entreprise?: string;
}
export interface Etat {
  version: number;
  moi: string;                     // id du recruteur connecté
  recruteurs: Recruteur[];
  entretiens: Entretien[];
  reglages: Reglages;
}

// ── Événements temps réel vers le panneau recruteur ─────────────────────
export type EvenementPanneau =
  | { type: "entretien_detecte"; entretienId: string }
  | { type: "defi_propose"; defi: Defi }
  | { type: "defi_en_cours"; defiId: string }
  | { type: "defi_resultat"; defi: Defi }
  | { type: "signal"; signal: Signal }
  | { type: "score"; score: Score }
  | { type: "entretien_termine" };

// ── Résultats côté candidat (page de pré-vérification) ──────────────────
export interface SignauxTechniques { cameras: string[]; fuseau: string; langue: string }
export interface SequenceLumiere { couleurs: string[]; horodatages: number[]; passe: boolean }
