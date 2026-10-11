/** Dictionnaire anglais du site : clé = texte français exact. Un fichier par groupe de pages. */
import { EN_PRECHECK } from './en.precheck';
import { EN_FACE } from './en.face';

export const EN: Record<string, string> = { ...EN_PRECHECK, ...EN_FACE };
