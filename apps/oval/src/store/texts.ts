import type { DecisionValeur, DefiResultat, DefiType, Resultat, SignalType, StatutPreVerif } from "./types";
import { t } from "../i18n";

/** Tous les libellés en français, au même endroit. Ton simple et humain. Jamais de verdict. */

export const SIGNAL_LIBELLES: Record<SignalType, string> = {
  camera_virtuelle: t("Caméra virtuelle déclarée par le navigateur"),
  camera_physique: t("Caméra physique détectée"),
  fuseau_horaire: t("Fuseau horaire et lieu déclaré"),
  adresse_connexion: t("Adresse de connexion et lieu déclaré"),
  vpn: t("Connexion via VPN"),
  test_lumiere: t("Test de lumière"),
  image_deformee: t("Image déformée pendant un geste"),
  defi_non_execute: t("Défi non exécuté dans le temps attendu"),
  delai_reponse: t("Délai de réponse inhabituel"),
  levres_son: t("Lèvres et son"),
  contradiction_cv: t("Information déclarée différente du CV"),
};

export const DEFI_PHRASES: Record<DefiType, string> = {
  main_devant_visage: t("Pouvez-vous passer la main devant votre visage ?"),
  rotation_tete: t("Pouvez-vous tourner la tête à gauche, puis à droite ?"),
  phrase_aleatoire: t("Pouvez-vous répéter : « Le train de midi part du quai sept » ?"),
};
export const DEFI_NOMS: Record<DefiType, string> = {
  main_devant_visage: t("Main devant le visage"),
  rotation_tete: t("Tourner la tête"),
  phrase_aleatoire: t("Phrase aléatoire"),
};
export const DEFI_DESCRIPTIONS: Record<DefiType, string> = {
  main_devant_visage: t("La main passe devant le visage : un flux substitué se déforme au passage."),
  rotation_tete: t("Le visage tourne de profil : les modèles de substitution décrochent sur les angles."),
  phrase_aleatoire: t("Une phrase imprévisible : on vérifie que les lèvres et le son restent alignés."),
};

export const DEFI_RESULTATS: Record<DefiResultat, string> = {
  propose: t("Proposé"),
  en_cours: t("En cours"),
  reussi: t("Réussi"),
  a_verifier: t("À vérifier"),
  non_concluant: t("Non concluant"),
  passe: t("Passé"),
};

export const RESULTATS: Record<Resultat, string> = {
  coherent: t("Cohérent"),
  a_verifier: t("À vérifier"),
  non_concluant: t("Non concluant"),
  passe: t("Étape passée"),
  rien_a_signaler: t("Rien à signaler"),
};

export const PREVERIF_STATUTS: Record<StatutPreVerif, string> = {
  non_envoyee: t("Lien non envoyé"),
  envoyee: t("Lien envoyé"),
  ouverte: t("Lien ouvert"),
  faite: t("Faite"),
  non_faite: t("Non faite"),
};

export const DECISIONS: Record<DecisionValeur, string> = {
  non_prise: t("En attente"),
  poursuivre: t("Poursuivre le recrutement"),
  refaire_defi: t("Refaire un défi au prochain échange"),
  presentiel: t("Proposer un entretien en présentiel"),
};

/** Étiquette de statut d'un entretien : toujours un mot à côté de la couleur. */
export const STATUTS_ENTRETIEN = {
  presence_verifiee: t("Présence vérifiée"),
  signal: t("Signal à vérifier"),
  a_venir: t("À venir"),
  en_cours: t("En cours"),
  non_concluant: t("Non concluant"),
} as const;

export const MANTA = {
  neutre: t("Tout va bien. Je regarde avec vous."),
  defi: t("Demandez-lui, naturellement :"),
  analyse: t("Je vérifie le geste…"),
  signal: t("Signal à vérifier."),
  verifie: t("Présence humaine vérifiée."),
  lumiere: t("J'éclaire ton visage avec quelques couleurs."),
  rappel: t("Oval vérifie une présence humaine, pas une identité. Vous décidez."),
};

export const DECISIONS_COURT: Record<DecisionValeur, string> = { non_prise: t("en attente"), poursuivre: t("poursuivre"), refaire_defi: t("refaire un défi"), presentiel: t("présentiel proposé") };
