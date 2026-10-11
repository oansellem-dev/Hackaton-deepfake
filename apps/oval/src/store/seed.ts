import type { Candidat, Couleur, Defi, Entretien, Etat, PreVerification, Resultat, Signal } from "./types";
import { DEFI_PHRASES } from "./texts";

/**
 * DONNÉES D'EXEMPLE — candidats fictifs.
 * Les dates sont calculées par rapport au moment du chargement, en jours ouvrés,
 * pour que le planning soit toujours parlant. Avant le pitch : Réglages → « Réinitialiser la démo ».
 */
export const SEED_VERSION = 7;

export function seed(): Etat {
  const now = new Date();
  /** n-ième jour ouvré à partir d'aujourd'hui (0 = aujourd'hui, même un week-end). */
  const ouvre = (n: number) => {
    const x = new Date(now); x.setHours(0, 0, 0, 0);
    const pas = n < 0 ? -1 : 1; let k = Math.abs(n);
    while (k > 0) { x.setDate(x.getDate() + pas); const j = x.getDay(); if (j !== 0 && j !== 6) k--; }
    return x;
  };
  const d = (n: number, h: number, m = 0) => { const x = ouvre(n); x.setHours(h, m, 0, 0); return x.toISOString(); };
  /** Dans `min` minutes, arrondi aux 5 minutes. */
  const dans = (min: number) => { const x = new Date(now.getTime() + min * 60000); x.setMinutes(Math.ceil(x.getMinutes() / 5) * 5, 0, 0); return x.toISOString(); };

  /** Photos de profil (portraits générés sur Higgsfield), servies depuis public/avatars/. */
  const photo = (id: string) => `/avatars/${id}.webp`;
  const cand = (prenom: string, nom: string, poste: string, couleur: Couleur, ville: string, id?: string): Candidat => ({
    prenom, nom, poste, couleur, villeDeclaree: ville, photo: id ? photo(id) : undefined,
    email: `${prenom}.${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@exemple.fr",
  });
  const sig = (id: string, type: Signal["type"], poids: Signal["poids"], libelle: string, explication: string, resultat: Resultat, source: Signal["source"], a: string, minute?: number): Signal =>
    ({ id, type, poids, libelle, explication, resultat, source, a, minute });
  const defi = (id: string, type: Defi["type"], resultat: Defi["resultat"], debutMin: number, finMin: number, detail: string, proposePar: Defi["proposePar"] = "manta"): Defi =>
    ({ id, type, phrase: DEFI_PHRASES[type], proposePar, debutMin, finMin, resultat, detail });
  const faite = (envoi: string, fait: string, lumiere: Resultat = "coherent", signaux: Signal[] = []): PreVerification =>
    ({ statut: "faite", envoyeeLe: envoi, ouverteLe: fait, faiteLe: fait, etapes: { accord: true, camera: true, lumiere, geste: "coherent" }, signaux });
  const envoyee = (envoi: string, relance?: string): PreVerification => ({ statut: "envoyee", envoyeeLe: envoi, relanceeLe: relance, etapes: {}, signaux: [] });
  const base = { defis: [] as Defi[], signaux: [] as Signal[], decision: { valeur: "non_prise" as const } };

  const noahPre = d(-2, 18, 12);
  const noahPreSignaux: Signal[] = [
    sig("s-n2", "test_lumiere", "moyen", "Test de lumière : séquence suivie", "Le visage a suivi la séquence de couleurs sans retard.", "coherent", "preverification", noahPre),
    sig("s-n3", "camera_physique", "info", "Caméra physique détectée", "Le navigateur déclare une webcam intégrée, aucune caméra virtuelle.", "rien_a_signaler", "preverification", noahPre),
    sig("s-n4", "fuseau_horaire", "moyen", "Fuseau horaire et lieu déclaré", "Europe/Paris, cohérent avec Lyon.", "coherent", "preverification", noahPre),
    sig("s-n5", "vpn", "info", "Connexion via VPN", "Un VPN d'entreprise est courant. Signalé pour information, ce n'est pas un signal négatif.", "rien_a_signaler", "preverification", noahPre),
  ];

  const entretiens: Entretien[] = [
    {
      ...base, id: "e-noah", candidat: cand("Noah", "Martin", "Développeur full-stack", "navy", "Lyon", "noah"), date: d(-1, 14), dureeMin: 42, statut: "termine", recruteurId: "cl",
      preVerification: faite(d(-4, 9), noahPre, "coherent", noahPreSignaux),
      defis: [
        defi("d-n1", "main_devant_visage", "reussi", 5, 9, "Geste exécuté"),
        defi("d-n2", "rotation_tete", "a_verifier", 19, 22, "Image déformée 1,4 s"),
        defi("d-n3", "phrase_aleatoire", "reussi", 30, 34, "Lèvres et son alignés", "recruteur"),
      ],
      signaux: [sig("s-n1", "image_deformee", "fort", "Image déformée pendant un geste", "Pendant la rotation de la tête, le contour du visage s'est déformé pendant 1,4 seconde. Ça peut venir d'une connexion instable : un second geste suffit à lever le doute.", "a_verifier", "entretien", d(-1, 14, 19), 19)],
      score: { valeur: 71, calculeLe: d(-1, 14, 45), resume: "Trois défis sur quatre sont réussis et l'environnement est cohérent. Un seul point reste ouvert : l'image s'est déformée 1,4 seconde quand Noah a tourné la tête.\n\nÇa peut venir d'une connexion instable. Un second geste en début de prochain échange suffit à lever le doute." },
      creeLe: d(-9, 10),
    },
    { ...base, id: "e-emma", visio: { url: "https://meet.google.com/kqp-wzrd-mta", fournisseur: "meet" }, candidat: cand("Emma", "Perrin", "Développeuse back-end", "coral", "Nantes", "emma"), date: dans(20), dureeMin: 60, statut: "a_venir", recruteurId: "je", preVerification: faite(d(-3, 9), d(-1, 19)), creeLe: d(-6, 11) },
    { ...base, id: "e-hugo", visio: { url: "https://zoom.us/j/84213356791", fournisseur: "zoom" }, candidat: cand("Hugo", "Besson", "Architecte cloud", "violet", "Toulouse", "hugo"), date: dans(140), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: envoyee(d(-3, 9)), creeLe: d(-5, 15) },
    {
      ...base, id: "e-ava", candidat: cand("Ava", "Tessier", "Cheffe de produit", "green", "Paris", "ava"), date: d(-4, 10, 30), dureeMin: 50, statut: "termine", recruteurId: "ts",
      preVerification: faite(d(-7, 9), d(-5, 20)),
      defis: [defi("d-a1", "main_devant_visage", "reussi", 4, 7, "Geste exécuté"), defi("d-a2", "phrase_aleatoire", "reussi", 25, 28, "Lèvres et son alignés")],
      score: { valeur: 96, calculeLe: d(-4, 11, 20), resume: "Les deux défis ont été exécutés sans déformation de l'image et la pré-vérification n'a rien relevé. Rien ne contredit ce qu'Ava a déclaré." },
      decision: { valeur: "poursuivre", par: "ts", le: d(-2, 11) }, creeLe: d(-12, 9),
    },
    {
      ...base, id: "e-ines", candidat: cand("Inès", "Morel", "Data analyst", "pink", "Rennes", "ines"), date: d(-5, 15), dureeMin: 40, statut: "termine", recruteurId: "je",
      preVerification: faite(d(-8, 9), d(-6, 21), "non_concluant"),
      defis: [defi("d-i1", "rotation_tete", "non_concluant", 6, 10, "Éclairage trop faible"), defi("d-i2", "main_devant_visage", "reussi", 14, 17, "Geste exécuté")],
      score: { valeur: 90, calculeLe: d(-5, 15, 45), resume: "Un défi réussi, un autre non concluant à cause d'un éclairage trop faible. Le test de lumière n'a pas pu conclure non plus : ce n'est pas un signal, simplement une information en moins. Aucune contradiction relevée." },
      decision: { valeur: "poursuivre", par: "je", le: d(-3, 16) }, creeLe: d(-14, 9),
    },
    { ...base, id: "e-camille", visio: { url: "https://meet.google.com/abc-defg-hij", fournisseur: "meet" }, candidat: cand("Camille", "Royer", "Développeuse front-end", "teal", "Paris", "camille"), date: d(1, 10), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { statut: "non_envoyee", etapes: {}, signaux: [] }, creeLe: d(0, 9) },
    { ...base, id: "e-leo", visio: { url: "https://meet.google.com/tyu-iopq-rst", fournisseur: "meet" }, candidat: cand("Léo", "Carlier", "Designer UI/UX", "blue", "Lille", "leo"), date: d(2, 11), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: faite(d(-3, 10), d(-1, 12)), creeLe: d(-8, 10) },
    {
      ...base, id: "e-marc", visio: { url: "https://zoom.us/j/81003344556", fournisseur: "zoom" }, candidat: cand("Marc", "Renaud", "Architecte cloud", "violet", "Lyon", "marc"), date: d(3, 11), dureeMin: 45, statut: "a_venir", recruteurId: "je",
      preVerification: faite(d(-2, 9), d(-1, 9, 2), "coherent", [sig("s-m1", "camera_virtuelle", "fort", "Caméra virtuelle déclarée par le navigateur", "Le navigateur liste « OBS Virtual Camera ». Un nom de périphérique n'est pas une preuve : certains candidats l'utilisent pour flouter leur fond. À vérifier avec un défi en direct.", "a_verifier", "preverification", d(-1, 9, 2))]),
      creeLe: d(-2, 14),
    },
    { ...base, id: "e-jade", visio: { url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_jade", fournisseur: "teams" }, candidat: cand("Jade", "Colin", "Rédactrice", "gold", "Strasbourg", "jade"), date: d(4, 15), dureeMin: 30, statut: "a_venir", recruteurId: "ts", preVerification: envoyee(d(-4, 9), d(-1, 9)), creeLe: d(-7, 10) },
    { ...base, id: "e-mia", visio: { url: "https://meet.google.com/mia-roch-eqa", fournisseur: "meet" }, candidat: cand("Mia", "Roche", "Ingénieure QA", "gold", "Bordeaux", "mia"), date: d(5, 9, 30), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: envoyee(d(-2, 10)), creeLe: d(-4, 16) },
    { ...base, id: "e-sofia", visio: { url: "https://zoom.us/j/87755443322", fournisseur: "zoom" }, candidat: cand("Sofia", "Adam", "Designer UI/UX", "coral", "Marseille", "sofia"), date: d(6, 10), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: faite(d(-2, 9), d(-1, 20)), creeLe: d(-3, 10) },
    { ...base, id: "e-lucas", visio: { url: "https://meet.google.com/luc-asmo-rin", fournisseur: "meet" }, candidat: cand("Lucas", "Morin", "Développeur mobile", "green", "Nice", "lucas"), date: d(7, 14), dureeMin: 45, statut: "a_venir", recruteurId: "ts", preVerification: faite(d(-1, 9), d(-1, 18), "passe"), creeLe: d(-3, 11) },
    // Semaine en cours : journées chargées, quelques chevauchements
    { ...base, id: "e-chloe", candidat: cand("Chloé", "Martin", "Développeuse front-end", "teal", "Paris", "chloe"), date: d(-5, 9), dureeMin: 45, statut: "termine", recruteurId: "cl", preVerification: faite(d(-8, 9), d(-6, 19)), creeLe: d(-9, 10) },
    { ...base, id: "e-manon", candidat: cand("Manon", "Petit", "Cheffe de produit", "violet", "Lyon", "manon"), date: d(-5, 11), dureeMin: 60, statut: "termine", recruteurId: "je", preVerification: faite(d(-8, 10), d(-6, 12)), creeLe: d(-9, 11) },
    { ...base, id: "e-tom", candidat: cand("Tom", "Girard", "Développeur back-end", "navy", "Nantes"), date: d(-4, 14), dureeMin: 45, statut: "termine", recruteurId: "ts", preVerification: faite(d(-7, 9), d(-5, 21)), creeLe: d(-8, 9) },
    { ...base, id: "e-zoe", candidat: cand("Zoé", "Garnier", "Data analyst", "pink", "Lille", "zoe"), date: d(-4, 16), dureeMin: 30, statut: "termine", recruteurId: "cl", preVerification: faite(d(-7, 10), d(-5, 8)), creeLe: d(-8, 12) },
    { ...base, id: "e-louise", candidat: cand("Louise", "Fabre", "Designer UI/UX", "coral", "Bordeaux", "louise"), date: d(-3, 10, 30), dureeMin: 45, statut: "termine", recruteurId: "je", preVerification: faite(d(-6, 9), d(-4, 18)), creeLe: d(-7, 10) },
    { ...base, id: "e-nathan", candidat: cand("Nathan", "Roux", "Architecte cloud", "blue", "Toulouse"), date: d(-3, 11), dureeMin: 45, statut: "termine", recruteurId: "ts", preVerification: faite(d(-6, 9), d(-4, 20)), creeLe: d(-7, 11) },
    { ...base, id: "e-anais", candidat: cand("Anaïs", "Leroy", "Ingénieure QA", "gold", "Rennes", "anais"), date: d(-2, 9, 30), dureeMin: 45, statut: "termine", recruteurId: "cl", preVerification: faite(d(-5, 9), d(-3, 19)), creeLe: d(-6, 9) },
    { ...base, id: "e-adrien", candidat: cand("Adrien", "Blanc", "Développeur full-stack", "green", "Marseille"), date: d(-2, 15), dureeMin: 45, statut: "termine", recruteurId: "je", preVerification: faite(d(-5, 10), d(-3, 12)), creeLe: d(-6, 10) },
    { ...base, id: "e-clara", candidat: cand("Clara", "Dubois", "Rédactrice", "teal", "Strasbourg", "clarad"), date: d(-1, 10), dureeMin: 45, statut: "termine", recruteurId: "ts", preVerification: faite(d(-4, 9), d(-2, 18)), creeLe: d(-5, 10) },
    // Semaine prochaine : planning rempli
    { ...base, id: "e-ines2", visio: { url: "https://meet.google.com/ine-sber-nar", fournisseur: "meet" }, candidat: cand("Inès", "Bernard", "Développeuse back-end", "violet", "Paris"), date: d(1, 9), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: faite(d(-2, 9), d(-1, 19)), creeLe: d(-4, 10) },
    { ...base, id: "e-yanis", candidat: cand("Yanis", "Moreau", "Développeur mobile", "navy", "Lyon"), date: d(1, 11, 30), dureeMin: 45, statut: "a_venir", recruteurId: "ts", preVerification: envoyee(d(-2, 10)), creeLe: d(-3, 10) },
    { ...base, id: "e-lea", visio: { url: "https://zoom.us/j/85566778899", fournisseur: "zoom" }, candidat: cand("Léa", "Fontaine", "Designer UI/UX", "pink", "Nantes"), date: d(1, 14), dureeMin: 60, statut: "a_venir", recruteurId: "je", preVerification: faite(d(-3, 9), d(-1, 12)), creeLe: d(-5, 10) },
    { ...base, id: "e-maxime", candidat: cand("Maxime", "Chevalier", "Architecte cloud", "blue", "Bordeaux"), date: d(1, 16), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: envoyee(d(-1, 9)), creeLe: d(-2, 9) },
    { ...base, id: "e-sarah", visio: { url: "https://meet.google.com/sar-ahla-mbe", fournisseur: "meet" }, candidat: cand("Sarah", "Lambert", "Cheffe de produit", "gold", "Lille"), date: d(2, 9, 30), dureeMin: 45, statut: "a_venir", recruteurId: "ts", preVerification: faite(d(-2, 9), d(-1, 21)), creeLe: d(-4, 11) },
    { ...base, id: "e-hugo2", candidat: cand("Hugo", "Lefevre", "Développeur full-stack", "teal", "Toulouse"), date: d(2, 11), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: { statut: "non_envoyee", etapes: {}, signaux: [] }, creeLe: d(0, 9) },
    { ...base, id: "e-eva", candidat: cand("Eva", "Mercier", "Data analyst", "coral", "Rennes"), date: d(2, 14, 30), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: envoyee(d(-1, 10), d(0, 9)), creeLe: d(-3, 10) },
    { ...base, id: "e-paul", visio: { url: "https://meet.google.com/pau-lsim-onn", fournisseur: "meet" }, candidat: cand("Paul", "Simon", "Développeur back-end", "green", "Nice"), date: d(3, 9), dureeMin: 45, statut: "a_venir", recruteurId: "ts", preVerification: faite(d(-1, 9), d(0, 8)), creeLe: d(-2, 10) },
    { ...base, id: "e-nina", candidat: cand("Nina", "Rousseau", "Ingénieure QA", "violet", "Paris"), date: d(3, 14), dureeMin: 45, statut: "a_venir", recruteurId: "je", preVerification: envoyee(d(-1, 11)), creeLe: d(-2, 11) },
    { ...base, id: "e-theo", visio: { url: "https://zoom.us/j/83344556677", fournisseur: "zoom" }, candidat: cand("Théo", "Vincent", "Développeur mobile", "navy", "Lyon"), date: d(4, 10), dureeMin: 45, statut: "a_venir", recruteurId: "cl", preVerification: faite(d(-1, 9), d(0, 10)), creeLe: d(-2, 9) },
    { ...base, id: "e-juliette", candidat: cand("Juliette", "Perrot", "Rédactrice", "pink", "Strasbourg"), date: d(4, 16), dureeMin: 30, statut: "a_venir", recruteurId: "ts", preVerification: envoyee(d(0, 9)), creeLe: d(0, 9) },
  ];

  return {
    version: SEED_VERSION,
    moi: "je",
    recruteurs: [
      { id: "je", initiales: "JE", nom: "Jules E.", couleur: "blue" },
      { id: "cl", initiales: "CL", nom: "Clara L.", couleur: "coral", photo: photo("clara") },
      { id: "ts", initiales: "TS", nom: "Théo S.", couleur: "green", photo: photo("theo") },
    ],
    entretiens,
    reglages: {
      lumiere: { dureeMs: 1000, fonduMs: 300, etapes: 5 },
      textesLien: { objet: "Deux minutes avant votre entretien", intro: "Bonjour {prenom}, voici un lien de deux minutes pour vérifier que votre caméra et votre connexion fonctionnent avant l'entretien. Aucune vidéo n'est enregistrée." },
      defisActifs: ["main_devant_visage", "rotation_tete", "phrase_aleatoire"],
    },
  };
}
