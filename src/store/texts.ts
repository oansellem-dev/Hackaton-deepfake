import type { DecisionValeur, DefiResultat, DefiType, Resultat, SignalType, StatutPreVerif } from "./types";

/** Tous les libellés en français, au même endroit. Ton simple et humain. Jamais de verdict. */

export const SIGNAL_LIBELLES: Record<SignalType, string> = {
  camera_virtuelle: "Caméra virtuelle déclarée par le navigateur",
  camera_physique: "Caméra physique détectée",
  fuseau_horaire: "Fuseau horaire et lieu déclaré",
  adresse_connexion: "Adresse de connexion et lieu déclaré",
  vpn: "Connexion via VPN",
  test_lumiere: "Test de lumière",
  image_deformee: "Image déformée pendant un geste",
  defi_non_execute: "Défi non exécuté dans le temps attendu",
  delai_reponse: "Délai de réponse inhabituel",
  levres_son: "Lèvres et son",
  contradiction_cv: "Information déclarée différente du CV",
};

export const DEFI_PHRASES: Record<DefiType, string> = {
  main_devant_visage: "Pouvez-vous passer la main devant votre visage ?",
  rotation_tete: "Pouvez-vous tourner la tête à gauche, puis à droite ?",
  phrase_aleatoire: "Pouvez-vous répéter : « Le train de midi part du quai sept » ?",
};
export const DEFI_NOMS: Record<DefiType, string> = {
  main_devant_visage: "Main devant le visage",
  rotation_tete: "Tourner la tête",
  phrase_aleatoire: "Phrase aléatoire",
};
export const DEFI_DESCRIPTIONS: Record<DefiType, string> = {
  main_devant_visage: "La main passe devant le visage : un flux substitué se déforme au passage.",
  rotation_tete: "Le visage tourne de profil : les modèles de substitution décrochent sur les angles.",
  phrase_aleatoire: "Une phrase imprévisible : on vérifie que les lèvres et le son restent alignés.",
};

export const DEFI_RESULTATS: Record<DefiResultat, string> = {
  propose: "Proposé",
  en_cours: "En cours",
  reussi: "Réussi",
  a_verifier: "À vérifier",
  non_concluant: "Non concluant",
  passe: "Passé",
};

export const RESULTATS: Record<Resultat, string> = {
  coherent: "Cohérent",
  a_verifier: "À vérifier",
  non_concluant: "Non concluant",
  passe: "Étape passée",
  rien_a_signaler: "Rien à signaler",
};

export const PREVERIF_STATUTS: Record<StatutPreVerif, string> = {
  non_envoyee: "Lien non envoyé",
  envoyee: "Lien envoyé",
  ouverte: "Lien ouvert",
  faite: "Faite",
  non_faite: "Non faite",
};

export const DECISIONS: Record<DecisionValeur, string> = {
  non_prise: "En attente",
  poursuivre: "Poursuivre le recrutement",
  refaire_defi: "Refaire un défi au prochain échange",
  presentiel: "Proposer un entretien en présentiel",
};

/** Étiquette de statut d'un entretien : toujours un mot à côté de la couleur. */
export const STATUTS_ENTRETIEN = {
  presence_verifiee: "Présence vérifiée",
  signal: "Signal à vérifier",
  a_venir: "À venir",
  en_cours: "En cours",
  non_concluant: "Non concluant",
} as const;

export const MANTA = {
  neutre: "Tout va bien. Je regarde avec vous.",
  defi: "Demandez-lui, naturellement :",
  analyse: "Je vérifie le geste…",
  signal: "Signal à vérifier.",
  verifie: "Présence humaine vérifiée.",
  lumiere: "J'éclaire ton visage avec quelques couleurs.",
  rappel: "Oval vérifie une présence humaine, pas une identité. Vous décidez.",
};

export const DECISIONS_COURT: Record<DecisionValeur, string> = { non_prise: "en attente", poursuivre: "poursuivre", refaire_defi: "refaire un défi", presentiel: "présentiel proposé" };
