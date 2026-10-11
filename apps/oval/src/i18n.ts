/**
 * LANGUES DU DASHBOARD — français (source) et anglais.
 * Convention : le texte français est la clé. `t("Nouvel entretien")` renvoie la traduction si la langue courante
 * est l'anglais, sinon le texte tel quel. Variables : `t("Lien envoyé {quand}", { quand })`.
 * La langue est choisie dans Réglages, gardée dans le navigateur, et la page se recharge : tous les textes
 * (y compris les constantes de module) sont ainsi calculés une seule fois dans la bonne langue.
 */
import { EN } from "./i18n/en";

export type Langue = "fr" | "en";
const CLE = "oval-lang";
export const LANGUES: { id: Langue; nom: string }[] = [{ id: "fr", nom: "Français" }, { id: "en", nom: "English" }];

function lire(): Langue {
  try { const l = localStorage.getItem(CLE); if (l === "fr" || l === "en") return l; } catch { /* navigation privée */ }
  return "fr";
}
export const langue: Langue = lire();
/** Locale pour Intl (dates, nombres). */
export const locale = langue === "en" ? "en-GB" : "fr-FR";
try { document.documentElement.lang = langue; } catch { /* hors navigateur */ }

export function changerLangue(l: Langue) {
  if (l === langue) return;
  try { localStorage.setItem(CLE, l); } catch { /* navigation privée */ }
  location.reload();
}

const manquantes = new Set<string>();
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = fr;
  if (langue !== "fr") {
    const tr = EN[fr];
    if (tr !== undefined) s = tr;
    else if (import.meta.env.DEV && !manquantes.has(fr)) { manquantes.add(fr); console.warn(`[i18n] traduction manquante : ${JSON.stringify(fr)}`); }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
