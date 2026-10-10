/**
 * MAGASIN CENTRAL — sauvegardé dans le navigateur (localStorage).
 * Toute l'interface lit `useEtat()` et écrit via `actions`.
 */
import { useSyncExternalStore } from "react";
import type { Decision, Defi, DefiType, Entretien, Etat, Reglages, Score, Signal } from "./types";
import { seed, SEED_VERSION } from "./seed";
import { DEFI_PHRASES } from "./texts";

const KEY = "oval-demo";
const abonnes = new Set<() => void>();
let etat: Etat = charger();

function charger(): Etat {
  try {
    const brut = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (brut) { const e = JSON.parse(brut) as Etat; if (e.version === SEED_VERSION) return e; }
  } catch { /* stockage indisponible : on repart des données d'exemple */ }
  return seed();
}
function sauver() { try { localStorage.setItem(KEY, JSON.stringify(etat)); } catch { /* ignore */ } }

export function getEtat(): Etat { return etat; }
export function setEtat(fn: (e: Etat) => Etat) { etat = fn(etat); sauver(); abonnes.forEach((cb) => cb()); }
export function useEtat(): Etat {
  return useSyncExternalStore((cb) => { abonnes.add(cb); return () => { abonnes.delete(cb); }; }, () => etat, () => etat);
}

/** « Aujourd'hui » : la date de démo si elle est réglée, sinon la vraie. */
export function aujourdhui(e: Etat = etat): Date { return e.reglages.dateDemo ? new Date(e.reglages.dateDemo) : new Date(); }

const maj = (id: string, fn: (x: Entretien) => Entretien) => setEtat((e) => ({ ...e, entretiens: e.entretiens.map((x) => (x.id === id ? fn(x) : x)) }));
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;
const iso = () => new Date().toISOString();

export const actions = {
  creerEntretien(c: { prenom: string; nom: string; email: string; poste: string; date: string }, envoyerLien: boolean): Entretien {
    const couleurs = ["blue", "violet", "green", "gold", "coral", "navy", "pink", "teal"] as const;
    const ent: Entretien = {
      id: uid("e"), creeLe: iso(), dureeMin: 45, statut: "a_venir", recruteurId: etat.moi,
      candidat: { prenom: c.prenom, nom: c.nom, email: c.email, poste: c.poste, couleur: couleurs[(c.nom.length + c.prenom.length) % couleurs.length] },
      date: c.date,
      preVerification: { statut: envoyerLien ? "envoyee" : "non_envoyee", envoyeeLe: envoyerLien ? iso() : undefined, etapes: {}, signaux: [] },
      defis: [], signaux: [], decision: { valeur: "non_prise" },
    };
    setEtat((e) => ({ ...e, entretiens: [ent, ...e.entretiens] }));
    return ent;
  },
  envoyerLien(id: string) { maj(id, (x) => ({ ...x, preVerification: { ...x.preVerification, statut: "envoyee", envoyeeLe: iso() } })); },
  relancerLien(id: string) { maj(id, (x) => ({ ...x, preVerification: { ...x.preVerification, statut: x.preVerification.statut === "non_envoyee" ? "envoyee" : x.preVerification.statut, relanceeLe: iso(), envoyeeLe: x.preVerification.envoyeeLe ?? iso() } })); },
  /** Page candidat : progression des étapes, puis résultat final (branché par l'équipe, voir integration.ts). */
  preVerifOuverte(id: string) { maj(id, (x) => ({ ...x, preVerification: { ...x.preVerification, statut: "ouverte", ouverteLe: x.preVerification.ouverteLe ?? iso() } })); },
  preVerifEtape(id: string, etapes: Partial<Entretien["preVerification"]["etapes"]>) { maj(id, (x) => ({ ...x, preVerification: { ...x.preVerification, etapes: { ...x.preVerification.etapes, ...etapes } } })); },
  preVerifFaite(id: string, signaux: Signal[]) { maj(id, (x) => ({ ...x, preVerification: { ...x.preVerification, statut: "faite", faiteLe: iso(), signaux } })); },
  ajouterDefi(id: string, type: DefiType, proposePar: Defi["proposePar"] = "manta"): Defi {
    const dfi: Defi = { id: uid("d"), type, phrase: DEFI_PHRASES[type], proposePar, resultat: "propose" };
    maj(id, (x) => ({ ...x, statut: x.statut === "a_venir" ? "en_cours" : x.statut, defis: [...x.defis, dfi] }));
    return dfi;
  },
  majDefi(id: string, defi: Defi) { maj(id, (x) => ({ ...x, defis: x.defis.some((d) => d.id === defi.id) ? x.defis.map((d) => (d.id === defi.id ? defi : d)) : [...x.defis, defi] })); },
  ajouterSignal(id: string, s: Signal) { maj(id, (x) => ({ ...x, signaux: [...x.signaux, s] })); },
  setScore(id: string, score: Score) { maj(id, (x) => ({ ...x, score })); },
  terminer(id: string) { maj(id, (x) => ({ ...x, statut: "termine" })); },
  decider(id: string, valeur: Decision["valeur"], note?: string) { maj(id, (x) => ({ ...x, decision: { valeur, note: note ?? x.decision.note, par: etat.moi, le: iso() } })); },
  noter(id: string, note: string) { maj(id, (x) => ({ ...x, decision: { ...x.decision, note } })); },
  reglages(r: Partial<Reglages>) { setEtat((e) => ({ ...e, reglages: { ...e.reglages, ...r } })); },
  reinitialiser() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setEtat(() => seed()); },
};

// ── Sélecteurs utiles ───────────────────────────────────────────────────
export const parId = (e: Etat, id: string) => e.entretiens.find((x) => x.id === id);
export const recruteur = (e: Etat, id: string) => e.recruteurs.find((r) => r.id === id) ?? e.recruteurs[0];
export const nomComplet = (x: Entretien) => `${x.candidat.prenom} ${x.candidat.nom}`;
export const initiales = (x: Entretien) => `${x.candidat.prenom[0] ?? ""}${x.candidat.nom[0] ?? ""}`.toUpperCase();
export const nbSignauxAVerifier = (x: Entretien) => [...x.preVerification.signaux, ...x.signaux].filter((s) => s.resultat === "a_verifier").length + x.defis.filter((d) => d.resultat === "a_verifier").length;
export const memeJour = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
