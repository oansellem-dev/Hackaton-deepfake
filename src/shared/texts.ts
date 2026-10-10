import type { DefiResultat, DefiType, Decision, SignalType, StatutPreVerif, TestLumiereResultat } from "./types";

/** Tous les libellés en français, au même endroit. Ton simple et humain. */

export const SIGNAL_LIBELLES: Record<SignalType, string> = {
  camera_virtuelle: "Caméra virtuelle déclarée par le navigateur",
  fuseau_incoherent: "Fuseau horaire différent du lieu déclaré",
  ip_incoherente: "Adresse de connexion différente du lieu déclaré",
  defi_non_execute: "Défi non exécuté dans le temps attendu",
  image_deformee: "Image déformée pendant le geste",
  delai_anormal: "Délai de réponse inhabituel",
  contradiction_cv: "Information déclarée différente du CV",
};

export const DEFI_PHRASES: Record<DefiType, string> = {
  main_devant_visage: "Pouvez-vous passer la main devant votre visage ?",
  rotation_tete: "Pouvez-vous tourner lentement la tête à gauche, puis à droite ?",
  phrase_aleatoire: "Pouvez-vous répéter : « Le train de midi part du quai sept » ?",
};

export const DEFI_NOMS: Record<DefiType, string> = {
  main_devant_visage: "Main devant le visage",
  rotation_tete: "Rotation de la tête",
  phrase_aleatoire: "Phrase à répéter",
};

export const DEFI_RESULTATS: Record<DefiResultat, string> = {
  en_attente: "En attente",
  en_cours: "Je vérifie le geste…",
  execute: "Geste exécuté",
  signal_a_verifier: "Signal à vérifier",
  non_concluant: "Non concluant",
};

export const PREVERIF_STATUTS: Record<StatutPreVerif, string> = {
  non_envoyee: "Non envoyée",
  envoyee: "En attente",
  faite: "Faite",
  non_faite: "Non faite",
};

export const LUMIERE_RESULTATS: Record<TestLumiereResultat, string> = {
  coherent: "Cohérent",
  incoherent: "Signal à vérifier",
  non_concluant: "Non concluant",
  passe: "Étape passée",
};

export const DECISIONS: Record<Decision, string> = {
  non_prise: "Décision à prendre",
  poursuivre: "Poursuivre le processus",
  revoir: "Revoir avec le candidat",
};

export const MANTA_PHRASES = {
  neutre: "Tout va bien. Je regarde avec vous.",
  analyse: "Je vérifie le geste…",
  verifie: "Présence humaine vérifiée.",
  lumiere: "Je vais éclairer ton visage quelques secondes.",
};
