import type { DefiResultat, Entretien, Resultat, Signal } from "./types";
import type { Ton } from "../ui/ui";
import { nbSignauxAVerifier } from "./store";
import { relatif } from "./format";
import { DEFI_NOMS } from "./texts";
import { t } from "../i18n";

/** Étiquettes de statut partagées par tous les écrans. Toujours un mot, jamais la couleur seule. */
export interface Etiquette { texte: string; ton: Ton }

/** Étapes de la pré-vérification réellement faites (une étape passée ne compte pas, sans être négative). */
export function etapesFaites(x: Entretien): number {
  const e = x.preVerification.etapes;
  return [e.accord, e.camera, e.lumiere && e.lumiere !== "passe", e.geste && e.geste !== "passe"].filter(Boolean).length;
}

export function statutEntretien(x: Entretien, ref: Date): Etiquette {
  if (x.statut === "termine") {
    if (nbSignauxAVerifier(x) > 0) return { texte: t("Signal à vérifier"), ton: "gold" };
    if (x.defis.length && x.defis.every((d) => d.resultat !== "reussi")) return { texte: t("Non concluant"), ton: "neutral" };
    return { texte: t("Présence vérifiée"), ton: "green" };
  }
  if (x.statut === "en_cours") return { texte: t("En cours"), ton: "today" };
  const min = (new Date(x.date).getTime() - ref.getTime()) / 60000;
  if (min <= 60 && min > -x.dureeMin) return { texte: min > 0 ? relatif(x.date, ref) : t("Maintenant"), ton: "today" };
  return { texte: t("À venir"), ton: "blue" };
}

export function statutPreVerif(x: Entretien, ref: Date): Etiquette {
  const p = x.preVerification;
  const n = etapesFaites(x);
  if (p.statut === "faite") {
    if (p.signaux.some((s) => s.resultat === "a_verifier")) return { texte: t("{n}/4 · Signal à vérifier", { n }), ton: "soft-gold" };
    if (p.etapes.lumiere === "passe") return { texte: t("{n}/4 · Lumière passée", { n }), ton: "soft-green" };
    if (p.etapes.lumiere === "non_concluant" || p.etapes.geste === "non_concluant") return { texte: t("{n}/4 · Non concluant", { n }), ton: "neutral" };
    return { texte: t("{n}/4 · Cohérent", { n }), ton: "soft-green" };
  }
  if (p.refuseeLe && p.statut === "non_faite") return { texte: t("Refusée · autre solution"), ton: "neutral" };
  if (p.statut === "non_envoyee") return { texte: t("Lien non envoyé"), ton: "neutral" };
  const passe = x.statut === "termine" || new Date(x.date).getTime() < ref.getTime();
  if (p.statut === "non_faite" || passe) return { texte: t("Non faite"), ton: "neutral" };
  if (p.statut === "ouverte") return { texte: t("Lien ouvert"), ton: "soft-violet" };
  return { texte: p.relanceeLe ? t("Relancé · en attente") : t("Lien envoyé · en attente"), ton: "soft-violet" };
}

/** Phrase courte qui résume le premier point à vérifier. */
export function premierSignal(x: Entretien): string {
  const d = x.defis.find((y) => y.resultat === "a_verifier");
  if (d) return t("{defi} : {detail}", { defi: DEFI_NOMS[d.type], detail: d.detail?.toLowerCase() ?? t("à vérifier") });
  const s = [...x.signaux, ...x.preVerification.signaux].find((y) => y.resultat === "a_verifier");
  return s ? s.libelle : t("Signal à vérifier");
}

/** Version douce d'une teinte (pour les en-têtes et les listes). */
export const doux = (t: Ton): Ton => (t === "green" ? "soft-green" : t === "gold" ? "soft-gold" : t === "violet" ? "soft-violet" : t === "blue" ? "soft-blue" : t);
/** Couleur du point qui accompagne un mot. */
export const point = (t: Ton) => (t.includes("green") ? "green" : t.includes("gold") ? "gold" : t.includes("violet") ? "violet" : t.includes("blue") || t === "today" ? "blue" : "neutral");

export function etiquetteDefi(r: DefiResultat): Etiquette {
  switch (r) {
    case "reussi": return { texte: t("Réussi"), ton: "soft-green" };
    case "a_verifier": return { texte: t("À vérifier"), ton: "soft-gold" };
    case "non_concluant": return { texte: t("Non concluant"), ton: "neutral" };
    case "passe": return { texte: t("Passé"), ton: "neutral" };
    case "en_cours": return { texte: t("En cours"), ton: "soft-blue" };
    default: return { texte: t("Proposé"), ton: "soft-blue" };
  }
}

export function etiquetteSignal(s: Signal): Etiquette {
  if (s.resultat === "a_verifier") return s.poids === "fort" ? { texte: t("Poids fort"), ton: "soft-gold" } : { texte: t("À vérifier"), ton: "soft-gold" };
  if (s.type === "vpn") return { texte: t("Courant, expliqué"), ton: "neutral" };
  if (s.resultat === "coherent") return { texte: t("Cohérent"), ton: "soft-green" };
  if (s.resultat === "rien_a_signaler") return { texte: t("Rien à signaler"), ton: "soft-green" };
  if (s.resultat === "passe") return { texte: t("Étape passée"), ton: "neutral" };
  return { texte: t("Non concluant"), ton: "neutral" };
}

/** Étiquette d'une étape de pré-vérification (absence = jamais négative). */
export function etiquetteEtape(v: boolean | Resultat | undefined): Etiquette {
  if (v === undefined) return { texte: t("Pas encore"), ton: "neutral" };
  if (v === true) return { texte: t("Fait"), ton: "soft-green" };
  if (v === false) return { texte: t("Sans caméra"), ton: "neutral" };
  if (v === "coherent" || v === "rien_a_signaler") return { texte: t("Cohérent"), ton: "soft-green" };
  if (v === "a_verifier") return { texte: t("À vérifier"), ton: "soft-gold" };
  if (v === "passe") return { texte: t("Passée"), ton: "neutral" };
  return { texte: t("Non concluant"), ton: "neutral" };
}
