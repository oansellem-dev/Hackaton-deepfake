/**
 * « DEMANDE À MANTA » — interprète une demande en français et exécute l'action.
 * Toute la logique est ici pour brancher un modèle de langage plus tard :
 * il suffira de remplacer `interpreter` en gardant la même signature.
 */
import type { Etat } from "./types";
import { actions, nomComplet } from "./store";
import { ouvrirNouvelEntretien } from "../app/events";
import { envoyerPreVerif } from "./envoi";

export interface Reponse {
  comprise: boolean;
  message: string;
  /** Action à exécuter (navigation, mutation). */
  executer?: () => void;
  /** Propositions si la demande n'est pas comprise. */
  suggestions?: { libelle: string; executer: () => void }[];
}

const normaliser = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/\s+/g, " ").trim();
const aller = (hash: string) => () => { location.hash = hash; };

function trouver(e: Etat, texte: string) {
  const t = normaliser(texte);
  return e.entretiens.find((x) => { const n = normaliser(nomComplet(x)); return t.includes(n) || t.includes(normaliser(x.candidat.prenom)) || t.includes(normaliser(x.candidat.nom)); });
}

export const ACTIONS_RAPIDES = (e: Etat): Reponse["suggestions"] => [
  { libelle: "Envoyer un lien", executer: ouvrirNouvelEntretien },
  { libelle: "Voir les rapports", executer: aller("#/entretiens?filtre=termines") },
  { libelle: `Signaux à vérifier (${e.entretiens.filter((x) => [...x.preVerification.signaux, ...x.signaux].some((s) => s.resultat === "a_verifier") || x.defis.some((d) => d.resultat === "a_verifier")).length})`, executer: aller("#/entretiens?filtre=signal") },
];

export function interpreter(demande: string, e: Etat): Reponse {
  const t = normaliser(demande);
  if (!t) return { comprise: false, message: "Dis-moi ce que tu veux vérifier.", suggestions: ACTIONS_RAPIDES(e) };

  // Envoyer / relancer un lien à X
  if (/(envoi|envoy|relanc)/.test(t) && /lien|pre ?verif/.test(t) || /^relanc/.test(t)) {
    const x = trouver(e, t);
    if (!x) return { comprise: false, message: "À qui envoyer le lien ? Je n'ai pas reconnu le nom.", suggestions: ACTIONS_RAPIDES(e) };
    const relance = x.preVerification.statut !== "non_envoyee";
    return { comprise: true, message: relance ? `Je relance ${nomComplet(x)} par e-mail.` : `J'envoie le lien de pré-vérification à ${nomComplet(x)}.`, executer: () => { void envoyerPreVerif(x.id, relance); } };
  }
  // Rejoindre l'entretien de Y (page de visio Oval)
  if (/rejoin|visio|appel|lance l.entretien/.test(t)) {
    const x = trouver(e, t);
    if (x) return { comprise: true, message: `On rejoint l'entretien de ${nomComplet(x)}.`, executer: aller(`#/visio/${x.id}`) };
  }
  // Ouvrir le rapport de Y
  if (/rapport|resultat|deroule/.test(t)) {
    const x = trouver(e, t);
    if (x) return { comprise: true, message: `J'ouvre le rapport de ${nomComplet(x)}.`, executer: aller(`#/rapport/${x.id}`) };
    return { comprise: true, message: "Voici les entretiens terminés, choisis un rapport.", executer: aller("#/entretiens?filtre=termines") };
  }
  // Signaux à vérifier
  if (/signa|verifier|a verif|doute|suspect/.test(t)) return { comprise: true, message: "Voici les entretiens avec un signal à vérifier.", executer: aller("#/entretiens?filtre=signal") };
  // Entretiens du jour / à venir
  if (/aujourd|du jour|ce matin|cet apres|ce soir/.test(t)) return { comprise: true, message: "Voici les entretiens d'aujourd'hui.", executer: aller("#/entretiens?filtre=aujourdhui") };
  if (/a venir|prochain|cette semaine|planning|agenda|calend/.test(t)) return { comprise: true, message: "Voici le planning de la semaine.", executer: aller("#/") };
  // Pré-vérifications en attente
  if (/pre ?verif|en attente|lien/.test(t)) return { comprise: true, message: "Voici les pré-vérifications en attente.", executer: aller("#/entretiens?filtre=preverif") };
  // Créer un entretien
  if (/nouvel|nouveau|creer|cree|ajout|planifi/.test(t)) return { comprise: true, message: "On crée un nouvel entretien.", executer: ouvrirNouvelEntretien };
  // Candidat seul → sa fiche
  const x = trouver(e, t);
  if (x) return { comprise: true, message: `Voici ${nomComplet(x)}.`, executer: aller(x.statut === "termine" ? `#/rapport/${x.id}` : `#/entretiens?q=${encodeURIComponent(x.candidat.nom)}`) };
  // Défis / réglages
  if (/defi|geste|main|tete|phrase/.test(t)) return { comprise: true, message: "Voici la bibliothèque de défis.", executer: aller("#/defis") };
  if (/reglage|parametre|lumiere|texte|reinit/.test(t)) return { comprise: true, message: "Voici les réglages.", executer: aller("#/reglages") };

  return { comprise: false, message: "Je n'ai pas compris. Voici ce que je sais faire :", suggestions: ACTIONS_RAPIDES(e) };
}

/** Exemples reconnus, affichés comme aide. */
export const EXEMPLES = ["Envoie un lien à Camille Royer", "Ouvre le rapport de Noah Martin", "Montre les signaux à vérifier", "Les entretiens d'aujourd'hui", "Relance Mia Roche", "Nouvel entretien"];
