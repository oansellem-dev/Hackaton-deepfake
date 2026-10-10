import type { Entretien } from "./types";
import type { Ton } from "../ui/ui";
import { nbSignauxAVerifier } from "./store";
import { relatif } from "./format";
import { DEFI_NOMS } from "./texts";

/** Étiquettes de statut partagées par tous les écrans. Toujours un mot, jamais la couleur seule. */
export interface Etiquette { texte: string; ton: Ton }

/** Étapes de la pré-vérification réellement faites (une étape passée ne compte pas, sans être négative). */
export function etapesFaites(x: Entretien): number {
  const e = x.preVerification.etapes;
  return [e.accord, e.camera, e.lumiere && e.lumiere !== "passe", e.geste && e.geste !== "passe"].filter(Boolean).length;
}

export function statutEntretien(x: Entretien, ref: Date): Etiquette {
  if (x.statut === "termine") {
    if (nbSignauxAVerifier(x) > 0) return { texte: "Signal à vérifier", ton: "gold" };
    if (x.defis.length && x.defis.every((d) => d.resultat !== "reussi")) return { texte: "Non concluant", ton: "neutral" };
    return { texte: "Présence vérifiée", ton: "green" };
  }
  if (x.statut === "en_cours") return { texte: "En cours", ton: "today" };
  const min = (new Date(x.date).getTime() - ref.getTime()) / 60000;
  if (min <= 60 && min > -x.dureeMin) return { texte: min > 0 ? relatif(x.date, ref) : "Maintenant", ton: "today" };
  return { texte: "À venir", ton: "blue" };
}

export function statutPreVerif(x: Entretien, ref: Date): Etiquette {
  const p = x.preVerification;
  const n = etapesFaites(x);
  if (p.statut === "faite") {
    if (p.signaux.some((s) => s.resultat === "a_verifier")) return { texte: `${n}/4 · Signal à vérifier`, ton: "soft-gold" };
    if (p.etapes.lumiere === "passe") return { texte: `${n}/4 · Lumière passée`, ton: "soft-green" };
    if (p.etapes.lumiere === "non_concluant" || p.etapes.geste === "non_concluant") return { texte: `${n}/4 · Non concluant`, ton: "neutral" };
    return { texte: `${n}/4 · Cohérent`, ton: "soft-green" };
  }
  if (p.statut === "non_envoyee") return { texte: "Lien non envoyé", ton: "neutral" };
  const passe = x.statut === "termine" || new Date(x.date).getTime() < ref.getTime();
  if (p.statut === "non_faite" || passe) return { texte: "Non faite", ton: "neutral" };
  if (p.statut === "ouverte") return { texte: "Lien ouvert", ton: "soft-violet" };
  return { texte: p.relanceeLe ? "Relancé · en attente" : "Lien envoyé · en attente", ton: "soft-violet" };
}

/** Phrase courte qui résume le premier point à vérifier. */
export function premierSignal(x: Entretien): string {
  const d = x.defis.find((y) => y.resultat === "a_verifier");
  if (d) return `${DEFI_NOMS[d.type]} : ${d.detail?.toLowerCase() ?? "à vérifier"}`;
  const s = [...x.signaux, ...x.preVerification.signaux].find((y) => y.resultat === "a_verifier");
  return s ? s.libelle : "Signal à vérifier";
}
