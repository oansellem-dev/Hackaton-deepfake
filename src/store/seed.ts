import type { Candidat, Couleur, Defi, Entretien, Etat, Signal } from "./types";
import { DEFI_PHRASES } from "./texts";

/** DONNÉES D'EXEMPLE — candidats fictifs. Rechargées si SEED_VERSION change. */
export const SEED_VERSION = 3;

const now = new Date();
const d = (jours: number, h: number, m = 0) => { const x = new Date(now); x.setDate(x.getDate() + jours); x.setHours(h, m, 0, 0); return x.toISOString(); };
const cand = (prenom: string, nom: string, poste: string, couleur: Couleur, ville?: string): Candidat => ({
  prenom, nom, poste, couleur, villeDeclaree: ville,
  email: `${prenom}.${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@exemple.fr",
});
const sig = (id: string, type: Signal["type"], poids: Signal["poids"], libelle: string, explication: string, resultat: Signal["resultat"], source: Signal["source"], a: string, minute?: number): Signal =>
  ({ id, type, poids, libelle, explication, resultat, source, a, minute });
const defi = (id: string, type: Defi["type"], resultat: Defi["resultat"], debutMin?: number, finMin?: number, detail?: string, proposePar: Defi["proposePar"] = "manta"): Defi =>
  ({ id, type, phrase: DEFI_PHRASES[type], proposePar, debutMin, finMin, resultat, detail });

const preOk = (jours: number, h: number) => ({ statut: "faite" as const, envoyeeLe: d(jours - 3, 9), ouverteLe: d(jours, h), faiteLe: d(jours, h, 4), etapes: { accord: true, camera: true, lumiere: "coherent" as const, geste: "coherent" as const }, signaux: [] as Signal[] });

export function seed(): Etat {
  const noahSignaux: Signal[] = [
    sig("s-n1", "image_deformee", "fort", "Image déformée pendant un geste", "Pendant la rotation de la tête, le contour du visage s'est déformé pendant 1,4 seconde. Ça peut venir d'une connexion instable : un second geste suffit à lever le doute.", "a_verifier", "entretien", d(-1, 14, 19), 19),
    sig("s-n2", "test_lumiere", "moyen", "Test de lumière : séquence suivie", "Le visage a suivi la séquence de couleurs sans retard.", "coherent", "preverification", d(-2, 18, 12)),
    sig("s-n3", "camera_physique", "info", "Caméra physique détectée", "Le navigateur déclare une webcam intégrée, aucune caméra virtuelle.", "rien_a_signaler", "preverification", d(-2, 18, 12)),
    sig("s-n4", "fuseau_horaire", "moyen", "Fuseau horaire et lieu déclaré", "Europe/Paris, cohérent avec Lyon.", "coherent", "preverification", d(-2, 18, 12)),
    sig("s-n5", "vpn", "info", "Connexion via VPN", "Un VPN d'entreprise est courant. Signalé pour information, pas un signal négatif.", "rien_a_signaler", "preverification", d(-2, 18, 12)),
  ];

  const entretiens: Entretien[] = [
    {
      id: "e-noah", candidat: cand("Noah", "Martin", "Développeur full-stack", "navy", "Lyon"), date: d(-1, 14), dureeMin: 42, statut: "termine", recruteurId: "cl",
      preVerification: { ...preOk(-2, 18), signaux: noahSignaux.filter((s) => s.source === "preverification") },
      defis: [
        defi("d-n1", "main_devant_visage", "reussi", 5, 10, "Geste exécuté"),
        defi("d-n2", "rotation_tete", "a_verifier", 15, 22, "Image déformée 1,4 s"),
        defi("d-n3", "phrase_aleatoire", "reussi", 30, 38, "Lèvres et son alignés", "recruteur"),
      ],
      signaux: noahSignaux.filter((s) => s.source === "entretien"),
      score: { valeur: 71, calculeLe: d(-1, 14, 45), resume: "Trois défis sur quatre sont réussis et l'environnement est cohérent. Un seul point reste ouvert : l'image s'est déformée 1,4 seconde quand Noah a tourné la tête.\n\nÇa peut venir d'une connexion instable. Un second geste en début de prochain échange suffit à lever le doute." },
      decision: { valeur: "non_prise" }, creeLe: d(-9, 10),
    },
    { id: "e-emma", candidat: cand("Emma", "Perrin", "Développeuse back-end", "coral", "Nantes"), date: d(0, 14), dureeMin: 60, statut: "a_venir", recruteurId: "je", preVerification: preOk(-1, 19), defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-6, 11) },
    { id: "e-hugo", candidat: cand("Hugo", "Besson", "Architecte cloud", "violet", "Toulouse"), date: d(0, 16), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { statut: "envoyee", envoyeeLe: d(-3, 9), etapes: {}, signaux: [] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-5, 15) },
    { id: "e-ava", candidat: cand("Ava", "Tessier", "Cheffe de produit", "green", "Paris"), date: d(-5, 10, 30), dureeMin: 50, statut: "termine", recruteurId: "ts", preVerification: preOk(-6, 20), defis: [defi("d-a1", "main_devant_visage", "reussi", 4, 8, "Geste exécuté"), defi("d-a2", "phrase_aleatoire", "reussi", 25, 30, "Lèvres et son alignés")], signaux: [], score: { valeur: 96, calculeLe: d(-5, 11, 20), resume: "Les deux défis ont été exécutés sans déformation de l'image et la pré-vérification n'a rien relevé. Rien ne contredit ce qu'Ava a déclaré." }, decision: { valeur: "poursuivre", par: "ts", le: d(-5, 11, 30) }, creeLe: d(-12, 9) },
    { id: "e-leo", candidat: cand("Léo", "Carlier", "Designer UI/UX", "blue", "Lille"), date: d(2, 11), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: preOk(-4, 12), defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-8, 10) },
    { id: "e-mia", candidat: cand("Mia", "Roche", "Ingénieure QA", "gold", "Bordeaux"), date: d(3, 9, 30), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { statut: "envoyee", envoyeeLe: d(-2, 10), etapes: {}, signaux: [] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-4, 16) },
    { id: "e-ines", candidat: cand("Inès", "Morel", "Data analyst", "pink", "Rennes"), date: d(-6, 15), dureeMin: 40, statut: "termine", recruteurId: "je", preVerification: { statut: "faite", envoyeeLe: d(-9, 9), ouverteLe: d(-7, 21), faiteLe: d(-7, 21, 3), etapes: { accord: true, camera: true, lumiere: "non_concluant", geste: "coherent" }, signaux: [] }, defis: [defi("d-i1", "rotation_tete", "non_concluant", 6, 12, "Éclairage trop faible"), defi("d-i2", "main_devant_visage", "reussi", 14, 18, "Geste exécuté")], signaux: [], score: { valeur: 90, calculeLe: d(-6, 15, 45), resume: "Un défi réussi, un autre non concluant à cause d'un éclairage trop faible. Le test de lumière n'a pas pu conclure non plus : ce n'est pas un signal, simplement une information en moins. Aucune contradiction relevée." }, decision: { valeur: "poursuivre", par: "je", le: d(-6, 16) }, creeLe: d(-14, 9) },
    { id: "e-sofia", candidat: cand("Sofia", "Adam", "Designer UI/UX", "coral", "Marseille"), date: d(6, 10), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: preOk(-1, 20), defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-3, 10) },
    { id: "e-lucas", candidat: cand("Lucas", "Morin", "Développeur mobile", "green", "Nice"), date: d(7, 14), dureeMin: 45, statut: "a_venir", recruteurId: "ts", preVerification: { statut: "faite", envoyeeLe: d(-2, 9), ouverteLe: d(-1, 8), faiteLe: d(-1, 8, 3), etapes: { accord: true, camera: true, lumiere: "passe", geste: "coherent" }, signaux: [] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-3, 11) },
    { id: "e-marc", candidat: cand("Marc", "Renaud", "Architecte cloud", "violet", "Lyon"), date: d(8, 11), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { ...preOk(-1, 9), signaux: [sig("s-m1", "camera_virtuelle", "fort", "Caméra virtuelle déclarée par le navigateur", "Le navigateur liste « OBS Virtual Camera ». Un nom de périphérique n'est pas une preuve : certains candidats l'utilisent pour flouter leur fond. À vérifier avec un défi en direct.", "a_verifier", "preverification", d(-1, 9, 2))] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-2, 14) },
    { id: "e-jade", candidat: cand("Jade", "Colin", "Rédactrice", "gold", "Strasbourg"), date: d(9, 15), dureeMin: 30, statut: "a_venir", recruteurId: "ts", preVerification: { statut: "non_faite", envoyeeLe: d(-6, 9), relanceeLe: d(-2, 9), etapes: {}, signaux: [] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(-7, 10) },
    { id: "e-camille", candidat: cand("Camille", "Royer", "Développeuse front-end", "teal", "Paris"), date: d(1, 10), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { statut: "non_envoyee", etapes: {}, signaux: [] }, defis: [], signaux: [], decision: { valeur: "non_prise" }, creeLe: d(0, 9) },
  ];

  return {
    version: SEED_VERSION,
    moi: "je",
    recruteurs: [
      { id: "je", initiales: "JE", nom: "Jules E.", couleur: "blue" },
      { id: "cl", initiales: "CL", nom: "Clara L.", couleur: "coral" },
      { id: "ts", initiales: "TS", nom: "Théo S.", couleur: "green" },
    ],
    entretiens,
    reglages: {
      lumiere: { dureeMs: 1000, fonduMs: 300, etapes: 5 },
      textesLien: { objet: "Deux minutes avant votre entretien", intro: "Bonjour {prenom}, voici un lien de deux minutes pour vérifier que votre caméra et votre connexion fonctionnent avant l'entretien. Aucune vidéo n'est enregistrée." },
      defisActifs: ["main_devant_visage", "rotation_tete", "phrase_aleatoire"],
    },
  };
}
