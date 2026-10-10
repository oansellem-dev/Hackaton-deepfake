import type { Entretien, Signal, Defi } from "./types";
import { DEFI_PHRASES, SIGNAL_LIBELLES } from "./texts";

/** DONNÉES D'EXEMPLE. Candidats fictifs. Remplacées par les vraies données via `api.ts`. */

const aujourdhui = new Date();
const iso = (h: number, m = 0, jours = 0) => {
  const d = new Date(aujourdhui);
  d.setDate(d.getDate() + jours);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const signalCamera: Signal = {
  id: "s1",
  type: "camera_virtuelle",
  niveau: "fort",
  libelle: SIGNAL_LIBELLES.camera_virtuelle,
  explication:
    "Le navigateur liste un périphérique nommé « OBS Virtual Camera ». Un nom de périphérique n'est pas une preuve : certains candidats l'utilisent pour flouter leur fond.",
  source: "preverification",
  horodatage: iso(9, 12),
};

const signalImage: Signal = {
  id: "s2",
  type: "image_deformee",
  niveau: "fort",
  libelle: SIGNAL_LIBELLES.image_deformee,
  explication:
    "Pendant le passage de la main, le contour du visage s'est déformé sur trois images consécutives.",
  source: "entretien",
  horodatage: iso(10, 18),
};

const signalFuseau: Signal = {
  id: "s3",
  type: "fuseau_incoherent",
  niveau: "moyen",
  libelle: SIGNAL_LIBELLES.fuseau_incoherent,
  explication:
    "L'ordinateur est réglé sur UTC+3 alors que le lieu déclaré est Lyon. Un VPN d'entreprise ou un déplacement l'expliquent souvent.",
  source: "preverification",
  horodatage: iso(8, 40),
};

const defi = (id: string, type: Defi["type"], resultat: Defi["resultat"], h?: number): Defi => ({
  id,
  type,
  phrase: DEFI_PHRASES[type],
  resultat,
  horodatage: h ? iso(h) : undefined,
});

export const ENTRETIENS: Entretien[] = [
  {
    id: "e1",
    candidat: { prenom: "Camille", nom: "Durand", email: "camille.durand@exemple.fr", villeDeclaree: "Nantes" },
    poste: "Développeur full-stack · Tech",
    date: iso(10, 0),
    statut: "a_venir",
    preVerification: { statut: "faite", signaux: [], testLumiere: "coherent" },
    defis: [],
    decision: "non_prise",
  },
  {
    id: "e2",
    candidat: { prenom: "Yanis", nom: "Benali", email: "yanis.benali@exemple.fr", villeDeclaree: "Lyon" },
    poste: "Développeur full-stack · Tech",
    date: iso(11, 30),
    statut: "a_venir",
    preVerification: { statut: "faite", signaux: [signalCamera, signalFuseau], testLumiere: "non_concluant" },
    defis: [],
    decision: "non_prise",
  },
  {
    id: "e3",
    candidat: { prenom: "Inès", nom: "Moreau", email: "ines.moreau@exemple.fr", villeDeclaree: "Bordeaux" },
    poste: "Data analyst · Produit",
    date: iso(14, 0),
    statut: "a_venir",
    preVerification: { statut: "envoyee", signaux: [] },
    defis: [],
    decision: "non_prise",
  },
  {
    id: "e4",
    candidat: { prenom: "Thomas", nom: "Lefèvre", email: "thomas.lefevre@exemple.fr", villeDeclaree: "Lille" },
    poste: "Chef de projet · Produit",
    date: iso(16, 30),
    statut: "a_venir",
    preVerification: { statut: "non_faite", signaux: [] },
    defis: [],
    decision: "non_prise",
  },
  {
    id: "e5",
    candidat: { prenom: "Léa", nom: "Rousseau", email: "lea.rousseau@exemple.fr", villeDeclaree: "Paris" },
    poste: "Développeur full-stack · Tech",
    date: iso(15, 0, -1),
    statut: "termine",
    preVerification: { statut: "faite", signaux: [], testLumiere: "coherent" },
    defis: [defi("d1", "main_devant_visage", "execute", 15), defi("d2", "rotation_tete", "execute", 15)],
    score: {
      valeur: 94,
      explications: [
        "Les deux défis ont été exécutés dans le temps attendu, sans déformation de l'image.",
        "La pré-vérification n'a relevé aucun signal : caméra, fuseau horaire et connexion cohérents avec Paris.",
        "Le test de lumière est cohérent : le visage a suivi la séquence de couleurs sans retard.",
      ],
      signaux: [],
    },
    decision: "poursuivre",
  },
  {
    id: "e6",
    candidat: { prenom: "Mehdi", nom: "Khelifi", email: "mehdi.khelifi@exemple.fr", villeDeclaree: "Lyon" },
    poste: "Développeur back-end · Tech",
    date: iso(11, 0, -1),
    statut: "termine",
    preVerification: { statut: "faite", signaux: [signalCamera], testLumiere: "incoherent" },
    defis: [defi("d3", "main_devant_visage", "signal_a_verifier", 11), defi("d4", "phrase_aleatoire", "execute", 11)],
    score: {
      valeur: 41,
      explications: [
        "Pendant le passage de la main, l'image du visage s'est déformée : c'est le signal le plus fort relevé.",
        "La pré-vérification a trouvé une caméra virtuelle. Ce n'est pas une preuve en soi, mais ça s'ajoute au signal précédent.",
        "Le test de lumière n'a pas suivi la séquence attendue. Ces trois points méritent une vérification, pas une conclusion.",
      ],
      signaux: [signalImage, signalCamera],
    },
    decision: "non_prise",
  },
  {
    id: "e7",
    candidat: { prenom: "Sofia", nom: "Martins", email: "sofia.martins@exemple.fr", villeDeclaree: "Toulouse" },
    poste: "Data analyst · Produit",
    date: iso(9, 30, -2),
    statut: "termine",
    preVerification: { statut: "non_faite", signaux: [] },
    defis: [defi("d5", "rotation_tete", "non_concluant", 9), defi("d6", "main_devant_visage", "execute", 9)],
    score: {
      valeur: 88,
      explications: [
        "Un défi exécuté sans déformation, un autre non concluant à cause d'un éclairage trop faible.",
        "La pré-vérification n'a pas été faite : ce n'est pas un signal, simplement une information en moins.",
        "Aucune contradiction relevée entre les informations déclarées et les signaux techniques.",
      ],
      signaux: [],
    },
    decision: "poursuivre",
  },
];

export const RECRUTEUR = { prenom: "Jules", equipe: ["AL", "SB", "MR", "NK"] };

export const SIGNAUX_EXEMPLE = { signalCamera, signalImage, signalFuseau };
