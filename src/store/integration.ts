/**
 * POINT DE BRANCHEMENT POUR L'ÉQUIPE
 * ---------------------------------
 * 1. Moteur de défis (brique B, analyse vidéo dans le navigateur) :
 *    - pendant la visio, appeler `emettre({...})` à chaque événement typé
 *      (ou `window.postMessage({ oval: {...} }, "*")`, déjà relayé ici) ;
 *    - sur la page candidat, remplacer `simulerGeste` et `simulerLumiere`
 *      par les vraies mesures (même signature).
 * 2. Serveur de score (brique D) : remplacer `calculerScore` par un appel
 *    HTTP qui renvoie un `Score`. Les données d'exemple sont dans seed.ts.
 * 3. Signaux techniques (brique A) : `relever()` lit ce que le navigateur
 *    expose ; l'adresse IP se relève côté serveur, ajoutez-la ici.
 */
import type { Defi, Entretien, EvenementPanneau, Resultat, Score, SequenceLumiere, Signal, SignauxTechniques } from "./types";
import { SIGNAL_LIBELLES } from "./texts";

// ── Flux temps réel vers le panneau recruteur ───────────────────────────
type Abonne = (ev: EvenementPanneau) => void;
const abonnes = new Set<Abonne>();
export function abonnerPanneau(cb: Abonne): () => void { abonnes.add(cb); return () => { abonnes.delete(cb); }; }
export function emettre(ev: EvenementPanneau): void { abonnes.forEach((cb) => cb(ev)); }
if (typeof window !== "undefined") {
  window.addEventListener("message", (m) => { if (m.data && typeof m.data === "object" && "oval" in m.data) emettre(m.data.oval as EvenementPanneau); });
}

// ── Brique A : signaux techniques côté candidat ─────────────────────────
export async function relever(): Promise<SignauxTechniques> {
  let cameras: string[] = [];
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    cameras = devs.filter((d) => d.kind === "videoinput").map((d) => d.label || "Caméra (nom non communiqué)");
  } catch { /* pas de périphériques : ce n'est pas un signal */ }
  return { cameras, fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone, langue: navigator.language };
}

/** Transforme les signaux techniques en `Signal` (règle : seules les contradictions comptent). */
export function signauxDepuis(t: SignauxTechniques, villeDeclaree?: string): Signal[] {
  const a = new Date().toISOString();
  const out: Signal[] = [];
  const virtuelle = t.cameras.find((c) => /virtual|obs|snap|manycam|xsplit/i.test(c));
  out.push(virtuelle
    ? { id: `s-${Date.now()}-cam`, type: "camera_virtuelle", poids: "fort", libelle: SIGNAL_LIBELLES.camera_virtuelle, explication: `Le navigateur liste « ${virtuelle} ». Un nom de périphérique n'est pas une preuve : à vérifier avec un défi en direct.`, resultat: "a_verifier", source: "preverification", a }
    : { id: `s-${Date.now()}-cam`, type: "camera_physique", poids: "info", libelle: t.cameras.length ? SIGNAL_LIBELLES.camera_physique : "Aucune caméra déclarée", explication: t.cameras.length ? "Aucune caméra virtuelle déclarée." : "Aucune caméra déclarée : ce n'est pas un signal.", resultat: "rien_a_signaler", source: "preverification", a });
  const parisien = /Europe\/(Paris|Brussels|Zurich|Luxembourg|Monaco)/.test(t.fuseau);
  out.push({ id: `s-${Date.now()}-tz`, type: "fuseau_horaire", poids: "moyen", libelle: SIGNAL_LIBELLES.fuseau_horaire, explication: `${t.fuseau}${villeDeclaree ? `, lieu déclaré : ${villeDeclaree}` : ""}. ${parisien || !villeDeclaree ? "Cohérent." : "Un déplacement ou un VPN l'expliquent souvent."}`, resultat: parisien || !villeDeclaree ? "coherent" : "a_verifier", source: "preverification", a });
  return out;
}

// ── Brique B : résultats simulés en attendant l'analyse vidéo ───────────
/** Remplacer par la mesure réelle : couleur moyenne de la peau, retard par rapport à la séquence. */
export async function simulerLumiere(seq: SequenceLumiere): Promise<Resultat> {
  if (seq.passe) return "passe";
  await attendre(600);
  return "coherent";
}
/** Remplacer par la détection réelle (MediaPipe : occlusion par la main, angle de la tête, délai). */
export async function simulerGeste(_stream: MediaStream | null): Promise<Resultat> {
  await attendre(900);
  return "coherent";
}
/** Pendant la visio : remplace la vérification réelle d'un défi. `avecSignal` sert au mode démo. */
export async function simulerDefi(defi: Defi, avecSignal: boolean): Promise<Defi> {
  await attendre(1800);
  const detail = avecSignal
    ? (defi.type === "main_devant_visage" ? "Image déformée au passage de la main" : defi.type === "rotation_tete" ? "Image déformée 1,4 s" : "Lèvres et son décalés")
    : (defi.type === "phrase_aleatoire" ? "Lèvres et son alignés" : "Geste exécuté");
  return { ...defi, resultat: avecSignal ? "a_verifier" : "reussi", detail, finMin: (defi.debutMin ?? 0) + 4 };
}

/** Signal associé à un défi « à vérifier » (le moteur vidéo enverra le sien). */
export function signalDefi(d: Defi): Signal {
  const levres = d.type === "phrase_aleatoire";
  return {
    id: `s-${Date.now().toString(36)}`, type: levres ? "levres_son" : "image_deformee", poids: "fort",
    libelle: levres ? "Lèvres et son décalés" : SIGNAL_LIBELLES.image_deformee,
    explication: levres ? "Le mouvement des lèvres et le son se sont décalés pendant la phrase. Une connexion lente peut l'expliquer : un autre défi suffit à lever le doute." : "Pendant le geste, le contour du visage s'est déformé. Ça peut venir d'une connexion instable : un second défi suffit à lever le doute.",
    resultat: "a_verifier", source: "entretien", a: new Date().toISOString(), minute: d.debutMin,
  };
}

// ── Brique D : score consultatif ────────────────────────────────────────
/** Remplacer par l'appel au serveur de score. Règles pondérées, résumé sans rien inventer. */
export function calculerScore(x: Entretien): Score {
  const pre = x.preVerification.signaux;
  // Un défi « à vérifier » et le signal qu'il produit sont le même incident : on ne le compte qu'une fois.
  const defisSignal = x.defis.filter((d) => d.resultat === "a_verifier");
  const fortsPre = pre.filter((s) => s.resultat === "a_verifier" && s.poids === "fort");
  const moyens = pre.filter((s) => s.resultat === "a_verifier" && s.poids === "moyen").length;
  const forts = defisSignal.length + fortsPre.length;
  const reussis = x.defis.filter((d) => d.resultat === "reussi").length;
  const preOk = x.preVerification.statut === "faite" && pre.every((s) => s.resultat !== "a_verifier");
  const valeur = Math.max(5, Math.min(99, 60 + reussis * 12 - forts * 22 - moyens * 8 + (preOk ? 10 : 0)));
  const phrases: string[] = [];
  if (reussis) phrases.push(`${reussis} défi${reussis > 1 ? "s" : ""} réussi${reussis > 1 ? "s" : ""} sans déformation de l'image.`);
  if (forts) phrases.push(`${forts} point${forts > 1 ? "s" : ""} à vérifier : ${[...defisSignal.map((d) => d.detail?.toLowerCase() ?? "défi à vérifier"), ...fortsPre.map((s) => s.libelle.toLowerCase())].join(", ")}. Ça peut venir d'une connexion instable : un autre défi aide à lever le doute.`);
  if (moyens) phrases.push("Les écarts de fuseau ou de connexion s'expliquent souvent par un VPN ou un déplacement.");
  if (x.preVerification.statut !== "faite") phrases.push("La pré-vérification n'a pas été faite : ce n'est pas un signal, simplement une information en moins.");
  if (!forts && !moyens) phrases.push("Rien ne contredit ce que le candidat a déclaré.");
  return { valeur, resume: phrases.join(" "), calculeLe: new Date().toISOString() };
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
