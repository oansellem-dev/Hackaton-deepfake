import type { Entretien } from "../shared/types";

/** Étiquette de statut d'un entretien. Toujours un mot à côté de la couleur. */
export function statutEntretien(e: Entretien): { texte: string; classe: string } {
  const signaux = (e.score?.signaux.length ?? 0) + e.preVerification.signaux.length;
  if (e.statut === "termine" && e.score) {
    if (signaux > 0) return { texte: "Signal à vérifier", classe: "pill--orange" };
    if (e.defis.some((d) => d.resultat === "non_concluant") && e.defis.every((d) => d.resultat !== "execute")) return { texte: "Non concluant", classe: "pill--gris" };
    return { texte: "Présence vérifiée", classe: "pill--vert" };
  }
  if (signaux > 0) return { texte: "Signal à vérifier", classe: "pill--orange" };
  return { texte: "En attente", classe: "pill--gris" };
}

export function Statut({ e }: { e: Entretien }) {
  const s = statutEntretien(e);
  return <span className={`pill ${s.classe}`}>{s.texte}</span>;
}
