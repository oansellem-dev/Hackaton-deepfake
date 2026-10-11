/** Dictionnaire anglais du dashboard : clé = texte français exact. Un fichier par groupe d'écrans. */
import { EN_COQUE } from "./en.coque";
import { EN_ECRANS } from "./en.ecrans";
import { EN_RAPPORT } from "./en.rapport";

export const EN: Record<string, string> = { ...EN_COQUE, ...EN_ECRANS, ...EN_RAPPORT };
