/**
 * POINT DE BRANCHEMENT
 * --------------------
 * Toute l'interface passe par ce fichier. Pour brancher les vraies données :
 *   - serveur de score : remplacer `getEntretiens`, `getEntretien`, `envoyerLien`,
 *     `enregistrerDecision` par des appels HTTP qui renvoient les mêmes types ;
 *   - moteur de défis : appeler `emettre({...})` (ou `window.postMessage` /
 *     `chrome.runtime.sendMessage` relayé vers `emettre`) à chaque événement.
 * Rien d'autre dans `src/` n'a besoin de changer.
 */
import type { Decision, Entretien, EvenementPanneau } from "./types";
import { ENTRETIENS } from "./mock";

let entretiens: Entretien[] = structuredClone(ENTRETIENS);

export async function getEntretiens(): Promise<Entretien[]> {
  return entretiens;
}

export async function getEntretien(id: string): Promise<Entretien | undefined> {
  return entretiens.find((e) => e.id === id);
}

export async function envoyerLien(email: string, date: string, poste: string): Promise<Entretien> {
  const e: Entretien = {
    id: `e${Date.now()}`,
    candidat: { prenom: "", nom: "", email },
    poste,
    date,
    statut: "a_venir",
    preVerification: { statut: "envoyee", signaux: [] },
    defis: [],
    decision: "non_prise",
  };
  entretiens = [e, ...entretiens];
  return e;
}

export async function enregistrerDecision(id: string, decision: Decision): Promise<void> {
  entretiens = entretiens.map((e) => (e.id === id ? { ...e, decision } : e));
}

// --- Flux d'événements vers le panneau recruteur ------------------------------

type Abonne = (ev: EvenementPanneau) => void;
const abonnes = new Set<Abonne>();

/** Le panneau s'abonne ici. Renvoie une fonction de désabonnement. */
export function abonnerPanneau(cb: Abonne): () => void {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}

/** Le moteur de défis et le serveur de score appellent ceci. */
export function emettre(ev: EvenementPanneau): void {
  abonnes.forEach((cb) => cb(ev));
}

// Pont optionnel : un script externe peut faire window.postMessage({ oval: {...} }, "*").
if (typeof window !== "undefined") {
  window.addEventListener("message", (m) => {
    if (m.data && typeof m.data === "object" && "oval" in m.data) emettre(m.data.oval as EvenementPanneau);
  });
}
