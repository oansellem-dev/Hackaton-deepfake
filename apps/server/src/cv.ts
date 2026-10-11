// CV du candidat (PDF chargé par le recruteur à la création de l'entretien).
// Lecture dans le serveur, sans l'agent Python : texte extrait, puis coordonnées, profils et écoles repérés.
// Le fichier n'est jamais conservé : on garde ce qui a été trouvé, pour pré-remplir le candidat et comparer ensuite
// ce qu'il déclare avec ce qu'il a écrit. Un écart est un signal à vérifier, jamais une preuve.
import { createRequire } from 'node:module';
import type { CvAnalysis, DeclaredIdentity, Signal } from '@kyc/shared';

const require = createRequire(import.meta.url);
// Import direct de la bibliothèque : l'index de pdf-parse tente de lire un fichier de test hors CommonJS.
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (data: Buffer) => Promise<{ text: string }>;

export type CvPrefill = NonNullable<CvAnalysis['prefill']>;

export async function extraireTexte(pdf: Buffer): Promise<string> {
  const { text } = await pdfParse(pdf);
  return text.replace(/ /g, ' ');
}

const ECOLES = /\b(universit[ée]|university|[ée]cole|school|institut|polytechnique|hec|essec|escp|edhec|em lyon|insa|ensimag|epitech|epita|42|dauphine|sorbonne|sciences po|centrale|mines|ensae|ensta|supaero|utc|utt|iut|bts|master|licence|bachelor|mba|ing[ée]nieur)\b/i;

/** Ce que le CV contient : adresses, téléphones, profils, écoles, et de quoi pré-remplir le candidat. */
export function analyserTexte(texte: string): { found: CvAnalysis['found']; prefill: CvPrefill } {
  const lignes = texte.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const uniq = (xs: string[]) => [...new Set(xs)];
  const emails = uniq((texte.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map((e) => e.toLowerCase()));
  const phones = uniq((texte.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?0\)?[\s.-]?)?\d(?:[\s.-]?\d{2}){4}\b/g) ?? []).map((p) => p.replace(/[\s.-]/g, '')).filter((p) => p.replace(/\D/g, '').length >= 9));
  const github = uniq((texte.match(/github\.com\/[A-Za-z0-9-]+/gi) ?? []).map((g) => `https://${g.replace(/^https?:\/\//i, '')}`));
  const linkedin = uniq((texte.match(/linkedin\.com\/in\/[A-Za-z0-9_%-]+/gi) ?? []).map((l) => `https://www.${l.replace(/^https?:\/\/(www\.)?/i, '')}`));
  const schools = uniq(lignes.filter((l) => ECOLES.test(l) && l.length < 90).slice(0, 6));

  // Nom : première ligne courte en deux à quatre mots qui ne contient ni chiffre ni « @ ».
  const nomLigne = lignes.slice(0, 8).find((l) => /^[A-ZÀ-Ý][\p{L}'’-]+(?:\s+[A-ZÀ-Ý][\p{L}'’-]+){1,3}$/u.test(l) && !/@|\d/.test(l) && l.length <= 40);
  const mots = nomLigne?.split(/\s+/) ?? [];
  const firstName = mots[0];
  const lastName = mots.length > 1 ? mots.slice(1).join(' ') : undefined;
  // Poste : la ligne qui suit le nom, si elle ressemble à un intitulé (courte, sans ponctuation lourde).
  const i = nomLigne ? lignes.indexOf(nomLigne) : -1;
  const suivante = i >= 0 ? lignes[i + 1] : undefined;
  const jobTitle = suivante && suivante.length <= 60 && !/@|\d{4}|www\.|\+/.test(suivante) ? suivante : undefined;
  const ville = texte.match(/\b(\d{5})\s+([A-ZÀ-Ý][\p{L}' -]{2,30})/u);

  return {
    found: { emails, phones, github, linkedin, schools },
    prefill: {
      firstName, lastName, jobTitle,
      email: emails[0], phone: phones[0], githubUrl: github[0], linkedinUrl: linkedin[0],
      city: ville ? ville[2].trim().split(/\s{2,}/)[0] : undefined,
    },
  };
}

const normEmail = (e = '') => e.trim().toLowerCase();
const normTel = (p = '') => p.replace(/\D/g, '').replace(/^33/, '0').slice(-9);
const normGit = (g = '') => (g.match(/github\.com\/([A-Za-z0-9-]+)/i)?.[1] ?? g.trim()).toLowerCase();
const normIn = (l = '') => (l.match(/linkedin\.com\/in\/([A-Za-z0-9_%-]+)/i)?.[1] ?? l.trim()).toLowerCase();

/** Déclarations du candidat face à son CV : identique = cohérent, différent = à vérifier, absent = sans effet. */
export function comparerCv(found: CvAnalysis['found'], d: Omit<DeclaredIdentity, 'consentAt'>, at = Date.now()): { signals: Signal[]; consistent: string[] } {
  const signals: Signal[] = [];
  const consistent: string[] = [];
  const champ = (id: string, label: string, declare: string | undefined, cv: string[], norm: (s: string) => string, nomCv: string) => {
    if (!declare?.trim() || !cv.length) return;
    const ok = cv.map(norm).includes(norm(declare));
    if (ok) consistent.push(label);
    signals.push({
      id: `cv.${id}`, source: 'cv', severity: 'medium', at, status: ok ? 'ok' : 'contradiction',
      label: ok ? `${label} identique au CV` : `${label} différent du CV`,
      detail: ok ? `La valeur déclarée correspond à celle du CV.` : `Déclaré : ${declare.trim()} · CV : ${cv.join(', ')}. ${nomCv} Un changement récent peut l'expliquer : à vérifier avec le candidat.`,
    });
  };
  champ('email', 'E-mail', d.email, found.emails, normEmail, '');
  champ('phone', 'Téléphone', d.phone, found.phones, normTel, '');
  champ('github', 'Profil GitHub', d.githubUrl, found.github, normGit, '');
  champ('linkedin', 'Profil LinkedIn', d.linkedinUrl, found.linkedin, normIn, '');
  return { signals, consistent };
}
