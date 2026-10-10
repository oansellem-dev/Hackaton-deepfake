/**
 * CONTRAT PARTAGÉ — Oval
 * ----------------------
 * Ce fichier est le seul contrat entre l'interface et les deux autres briques :
 *   - le moteur de défis (analyse vidéo) produit des `Defi` et des `Signal` de source "entretien" ;
 *   - le serveur de score produit un `Score`.
 * Gardez-le petit. Si vous ajoutez un champ, dites-le à l'équipe interface.
 *
 * Vocabulaire imposé : jamais de verdict. On parle de « signal à vérifier »
 * et de « présence humaine vérifiée ». Jamais « identité vérifiée ».
 */

export type Niveau = "fort" | "moyen";

export type SignalType =
  | "camera_virtuelle"
  | "fuseau_incoherent"
  | "ip_incoherente"
  | "defi_non_execute"
  | "image_deformee"
  | "delai_anormal"
  | "contradiction_cv";

export interface Signal {
  id: string;
  type: SignalType;
  niveau: Niveau;
  /** Ex. : « Caméra virtuelle déclarée par le navigateur » */
  libelle: string;
  /** Toujours nuancé : « un nom de périphérique n'est pas une preuve ». */
  explication: string;
  source: "preverification" | "entretien";
  /** ISO 8601 */
  horodatage: string;
}

export type DefiType = "main_devant_visage" | "rotation_tete" | "phrase_aleatoire";

export type DefiResultat =
  | "en_attente"
  | "en_cours"
  | "execute"
  | "signal_a_verifier"
  | "non_concluant";

export interface Defi {
  id: string;
  type: DefiType;
  /** La phrase naturelle suggérée au recruteur. */
  phrase: string;
  resultat: DefiResultat;
  horodatage?: string;
}

export interface Score {
  /** 0 à 100. Consultatif : le recruteur décide. */
  valeur: number;
  /** Exactement trois lignes, rédigées à partir des signaux, sans rien inventer. */
  explications: [string, string, string];
  signaux: Signal[];
}

export type TestLumiereResultat = "coherent" | "incoherent" | "non_concluant" | "passe";

export type StatutPreVerif = "non_envoyee" | "envoyee" | "faite" | "non_faite";

/** La décision appartient au recruteur. Jamais « refuser ». */
export type Decision = "non_prise" | "poursuivre" | "revoir";

export type StatutEntretien = "a_venir" | "en_cours" | "termine";

export interface Candidat {
  prenom: string;
  nom: string;
  email: string;
  villeDeclaree?: string;
}

export interface Entretien {
  id: string;
  candidat: Candidat;
  poste: string;
  /** ISO 8601 */
  date: string;
  statut: StatutEntretien;
  preVerification: {
    statut: StatutPreVerif;
    signaux: Signal[];
    testLumiere?: TestLumiereResultat;
  };
  defis: Defi[];
  score?: Score;
  decision: Decision;
}

/**
 * Événements que le moteur de défis et le serveur de score poussent vers le
 * panneau recruteur pendant la visio. Voir `api.ts` → `abonnerPanneau`.
 */
export type EvenementPanneau =
  | { type: "entretien_detecte"; entretien: Entretien }
  | { type: "defi_propose"; defi: Defi }
  | { type: "defi_en_cours"; defiId: string }
  | { type: "defi_resultat"; defi: Defi }
  | { type: "score_mis_a_jour"; score: Score }
  | { type: "entretien_termine" };
