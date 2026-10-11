/**
 * LANGUES DU SITE DU MOTEUR (parcours candidat) — français (source) et anglais.
 * Convention : le texte français est la clé. `t("Continuer")` renvoie la traduction en anglais, sinon le texte.
 * Variables : `t("Bonjour {prenom}", { prenom })`.
 * Langue : choix gardé dans le navigateur, sinon celle du navigateur (anglais par défaut hors francophones).
 * Changer de langue recharge la page : tous les textes sont calculés une fois dans la bonne langue.
 */
import { EN } from './i18n/en';

export type Lang = 'fr' | 'en';
const KEY = 'oval-lang';
export const LANGS: { id: Lang; name: string }[] = [{ id: 'fr', name: 'Français' }, { id: 'en', name: 'English' }];

function read(): Lang {
  try { const l = localStorage.getItem(KEY); if (l === 'fr' || l === 'en') return l; } catch { /* navigation privée */ }
  try { return /^fr\b/i.test(navigator.language) ? 'fr' : 'en'; } catch { return 'fr'; }
}
export const lang: Lang = read();
/** Locale pour Intl (dates, heures). */
export const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
try { document.documentElement.lang = lang; } catch { /* hors navigateur */ }

export function setLang(l: Lang) {
  if (l === lang) return;
  try { localStorage.setItem(KEY, l); } catch { /* navigation privée */ }
  location.reload();
}

const missing = new Set<string>();
export function t(fr: string, vars?: Record<string, string | number>): string {
  let s = fr;
  if (lang !== 'fr') {
    const tr = EN[fr];
    if (tr !== undefined) s = tr;
    else if (import.meta.env.DEV && !missing.has(fr)) { missing.add(fr); console.warn(`[i18n] missing translation: ${JSON.stringify(fr)}`); }
  }
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
