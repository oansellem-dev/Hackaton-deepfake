/**
 * MOTEUR — pont entre Oval et le serveur de l'équipe (apps/server, port 8787).
 * Oval reste la source d'affichage ; le serveur est la source de vérité des entretiens qui lui sont reliés.
 * Tout passe par /api/* (relayé par Vite vers 8787, même origine). Aucune image ne transite ici.
 * Contrat et correspondance : docs/contrat-front-back.md.
 */
import type { ChallengeRun, Decision as DecisionMoteur, SessionView, Signal as SignalMoteur } from "@kyc/shared";
import { combineFlashAttempts } from "@kyc/shared";
import type { Defi, DefiResultat, DefiType, Entretien, Poids, Resultat, Signal, SignalType } from "./types";
import { actions, getEtat } from "./store";
import { DEFI_PHRASES } from "./texts";
import { moteurUrl } from "./email";

const iso = (ms: number) => new Date(ms).toISOString();

/* ── Client de l'API ─────────────────────────────────────────── */
async function appel<T>(chemin: string, init: RequestInit = {}, cle?: string): Promise<T> {
  const r = await fetch(chemin, { ...init, headers: { "Content-Type": "application/json", ...(cle ? { "X-Recruiter-Key": cle } : {}), ...init.headers } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text().catch(() => "")}`.trim());
  return r.json() as Promise<T>;
}

/** Le moteur répond-il ? (GET /api/health, 1,5 s au plus) */
export async function moteurDisponible(): Promise<boolean> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch("/api/health", { signal: ctl.signal });
    clearTimeout(t);
    return r.ok && (await r.json()).ok === true;
  } catch { return false; }
}

/** Mode courant : « moteur » si réglé ainsi, « démo » sinon. */
export const modeMoteur = () => getEtat().reglages.donnees === "moteur";

/** Créneaux libres du recruteur sur les dix prochains jours ouvrés (09:30, 11:00, 14:00, 16:00), hors chevauchement. */
export function disponibilites(x: Entretien, max = 6): number[] {
  const e = getEtat();
  const pris = e.entretiens.filter((y) => y.id !== x.id && y.recruteurId === x.recruteurId && y.statut !== "termine").map((y) => ({ a: +new Date(y.date), b: +new Date(y.date) + y.dureeMin * 60000 }));
  const out: number[] = [];
  const j = new Date(); j.setHours(0, 0, 0, 0);
  for (let n = 0; n < 14 && out.length < max; n++) {
    j.setDate(j.getDate() + 1);
    if (j.getDay() === 0 || j.getDay() === 6) continue;
    for (const [h, m] of [[9, 30], [11, 0], [14, 0], [16, 0]]) {
      const d = new Date(j); d.setHours(h, m, 0, 0);
      const a = d.getTime(), b = a + x.dureeMin * 60000;
      if (a < Date.now() + 3600000 || Math.abs(a - +new Date(x.date)) < 60000) continue;
      if (pris.some((p) => a < p.b && b > p.a)) continue;
      out.push(a);
      if (out.length >= max) break;
    }
  }
  return out;
}

const chargeCreneau = (x: Entretien) => ({ at: +new Date(x.date), durationMin: x.dureeMin, visioUrl: x.visio?.url, recruiterName: getEtat().recruteurs.find((r) => r.id === x.recruteurId)?.nom, alternatives: disponibilites(x) });

/** Crée la session côté serveur et relie l'entretien : identifiants, clé recruteur, lien candidat du moteur. */
export async function creerSession(x: Entretien): Promise<Entretien["moteur"]> {
  const e = getEtat();
  const entreprise = e.reglages.entreprise?.trim();
  const v = await appel<SessionView & { recruiterKey: string }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ candidateLabel: `${x.candidat.prenom} ${x.candidat.nom}`.trim(), controllerName: entreprise || undefined, controllerContact: entreprise ? e.recruteurs.find((r) => r.id === e.moi)?.nom : undefined, schedule: chargeCreneau(x) }),
  });
  const moteur = { sessionId: v.id, recruiterKey: v.recruiterKey, lienToken: v.candidateLink?.token };
  actions.lierMoteur(x.id, moteur, { token: v.candidateLink?.token ?? "", expireLe: iso(v.candidateLink?.expiresAt ?? Date.now()) });
  return moteur;
}

/** Après un déplacement dans le calendrier, ou pour accepter la proposition du candidat : le moteur reçoit le créneau à jour. */
export async function envoyerCreneau(id: string): Promise<void> {
  const x = getEtat().entretiens.find((e) => e.id === id);
  if (!x?.moteur) return;
  const v = await appel<SessionView>(`/api/sessions/${x.moteur.sessionId}/schedule`, { method: "POST", body: JSON.stringify(chargeCreneau(x)) }, x.moteur.recruiterKey);
  const frais = getEtat().entretiens.find((e) => e.id === id);
  if (frais) actions.remplacer(versEntretien(v, frais));
}

export async function lireSession(x: Entretien): Promise<SessionView> {
  if (!x.moteur) throw new Error("entretien non relié au moteur");
  return appel<SessionView>(`/api/sessions/${x.moteur.sessionId}`, {}, x.moteur.recruiterKey);
}

/** Décision du recruteur (valeurs communes, décision 2 du contrat). Le serveur efface alors les biométries. */
export async function envoyerDecision(x: Entretien, valeur: DecisionMoteur, note?: string): Promise<void> {
  if (!x.moteur) return;
  const v = await appel<SessionView>(`/api/sessions/${x.moteur.sessionId}/decision`, { method: "POST", body: JSON.stringify({ value: valeur, note }) }, x.moteur.recruiterKey);
  actions.remplacer(versEntretien(v, { ...x, decision: { ...x.decision, valeur, note } }));
}

/** Panneau recruteur du moteur (le même que dans le widget de l'extension), pour un entretien qui y est relié. */
export const lienPanneau = (x: Entretien) => (x.moteur ? `${moteurUrl()}/panel/${x.moteur.sessionId}?key=${x.moteur.recruiterKey}` : null);

/* ── Correspondance session → Entretien ─────────────────────── */
const DEFIS: Record<string, DefiType> = { "hand-over-face": "main_devant_visage", "head-turn": "rotation_tete", "random-phrase": "phrase_aleatoire" };
const resultatDefi = (r: ChallengeRun["result"]): DefiResultat => (r === "passed" ? "reussi" : r === "failed" ? "a_verifier" : "non_concluant");
const resultatEtape = (r: ChallengeRun["result"] | "passed" | "failed" | "inconclusive"): Resultat => (r === "passed" ? "coherent" : r === "failed" ? "a_verifier" : "non_concluant");

/** Masqués dans Oval (décision 3) : comparaison de visages, gabarit, appareil. Le refus et le retrait passent par le statut. */
const MASQUES = /^(face\.|device\.)/;
function typeSignal(s: SignalMoteur): SignalType | null {
  if (MASQUES.test(s.id)) return null;
  if (s.id === "precheck.virtual-camera") return s.status === "contradiction" ? "camera_virtuelle" : "camera_physique";
  if (s.id === "live.virtual-camera") return "camera_virtuelle";
  if (s.id === "precheck.timezone") return "fuseau_horaire";
  if (s.id === "precheck.ip") return "adresse_connexion";
  if (s.id === "precheck.screen-flash") return "test_lumiere";
  if (s.id.startsWith("identity.") || s.id.startsWith("cv.")) return "contradiction_cv";
  if (s.id.startsWith("challenge.")) return s.status === "contradiction" ? "defi_non_execute" : null; // les défis réussis sont déjà dans defis[]
  return null;
}
function versSignal(s: SignalMoteur, debut: number | null): Signal | null {
  const type = typeSignal(s);
  if (!type) return null;
  // Règle n°1 : « unknown » n'est jamais un signal à vérifier ; « ok » de poids moyen = simple information.
  const resultat: Resultat = s.status === "contradiction" ? "a_verifier" : s.status === "ok" ? (s.severity === "strong" ? "coherent" : "rien_a_signaler") : "non_concluant";
  const poids: Poids = s.status === "unknown" ? "info" : s.severity === "strong" ? "fort" : "moyen";
  const live = s.source === "challenge" && debut !== null && s.at >= debut;
  return { id: `m-${s.id}`, type, poids, libelle: s.label, explication: s.detail, resultat, source: live ? "entretien" : "preverification", a: iso(s.at), ...(live ? { minute: Math.max(0, Math.round((s.at - debut) / 60000)) } : {}) };
}

/** Applique la session du moteur sur la copie locale (poste, couleur, recruteur et notes restent ceux d'Oval). */
export function versEntretien(v: SessionView, x: Entretien): Entretien {
  const p = x.preVerification;
  const lien = v.candidateLink ? { token: v.candidateLink.token, expireLe: iso(v.candidateLink.expiresAt), utiliseLe: v.candidateLink.usedAt ? iso(v.candidateLink.usedAt) : undefined } : p.lien;
  const faceFait = !!v.faceId?.completedAt;
  const ouverte = !!v.identity || !!v.candidateLink?.usedAt;
  const refus = (!!v.biometricOptOut || !!v.consent?.withdrawnAt) && !faceFait;
  const statut = refus ? "non_faite" : faceFait ? "faite" : ouverte ? "ouverte" : p.statut;

  const live = v.challenges.filter((c) => c.phase !== "precheck");
  const debut = live.length ? Math.min(...live.map((c) => c.at)) : null;
  const geste = v.challenges.filter((c) => c.phase === "precheck" && c.challengeId === "hand-over-face").at(-1);
  const flash = v.screenFlash;
  const lumiere: Resultat | undefined = !flash?.final ? undefined : flash.skipped ? "passe" : resultatEtape(combineFlashAttempts(flash.attempts).result);

  const signaux = v.signals.map((s) => versSignal(s, debut)).filter((s): s is Signal => !!s);
  const defis: Defi[] = live.map((c, i) => {
    const type = DEFIS[c.challengeId] ?? "main_devant_visage";
    const debutMin = debut === null ? 0 : Math.round((c.at - debut) / 60000);
    return { id: `m-defi-${i}`, type, phrase: DEFI_PHRASES[type], proposePar: "manta", debutMin, finMin: debutMin + Math.max(1, Math.round(c.durationMs / 60000)), resultat: resultatDefi(c.result) };
  });
  const score = v.precheckDone || live.length ? { valeur: v.score.value, resume: v.score.explanation.join("\n\n"), calculeLe: iso(Date.now()) } : x.score;
  const decision = v.decision ? { ...x.decision, valeur: v.decision.value, note: v.decision.note ?? x.decision.note, le: iso(v.decision.at), par: x.decision.par ?? getEtat().moi } : x.decision;
  const statutEntretien = v.decision ? "termine" : live.length && x.statut === "a_venir" ? "en_cours" : x.statut;

  const rep = v.schedule?.response;
  const creneau: Entretien["creneau"] = v.schedule
    ? rep?.kind === "confirmed" ? { statut: "confirme", repondueLe: iso(rep.at), message: rep.message }
      : rep?.kind === "proposed" ? { statut: "propose", propose: iso(rep.slot ?? rep.at), repondueLe: iso(rep.at), message: rep.message }
        : { statut: "attente" }
    : x.creneau;

  return {
    ...x,
    creneau,
    candidat: { ...x.candidat, prenom: v.identity?.firstName || x.candidat.prenom, nom: v.identity?.lastName || x.candidat.nom, email: v.identity?.email || x.candidat.email, villeDeclaree: v.identity?.city || x.candidat.villeDeclaree },
    preVerification: {
      ...p, statut, lien,
      ouverteLe: p.ouverteLe ?? (ouverte ? iso(v.identity?.consentAt ?? v.candidateLink?.usedAt ?? Date.now()) : undefined),
      faiteLe: faceFait ? iso(v.faceId!.completedAt!) : p.faiteLe,
      refuseeLe: refus ? iso(v.biometricOptOut?.at ?? v.consent?.withdrawnAt ?? Date.now()) : p.refuseeLe,
      // Une étape absente reste indéterminée : jamais négative.
      etapes: { accord: v.consent?.infoAt ? true : p.etapes.accord, camera: v.precheckDone ? true : p.etapes.camera, lumiere: lumiere ?? p.etapes.lumiere, geste: geste ? resultatEtape(geste.result) : p.etapes.geste },
      signaux: signaux.filter((s) => s.source === "preverification"),
    },
    signaux: signaux.filter((s) => s.source === "entretien"),
    defis: defis.length ? defis : x.defis,
    score, decision, statut: statutEntretien,
    dureeMin: v.decision && defis.length ? Math.max(x.dureeMin, ...defis.map((d) => (d.finMin ?? 0) + 4)) : x.dureeMin,
  };
}

/* ── Synchronisation ─────────────────────────────────────────── */
export async function synchroniser(x: Entretien): Promise<void> {
  const v = await lireSession(x);
  const frais = getEtat().entretiens.find((e) => e.id === x.id);
  if (frais) actions.remplacer(versEntretien(v, frais));
}

/** Toutes les 4 s : les entretiens reliés au moteur et non terminés. Renvoie la fonction d'arrêt. */
export function demarrerSynchro(periodeMs = 4000): () => void {
  let enCours = false;
  const tour = async () => {
    if (enCours || !modeMoteur()) return;
    enCours = true;
    try { await Promise.all(getEtat().entretiens.filter((x) => x.moteur && x.statut !== "termine").map((x) => synchroniser(x).catch(() => undefined))); }
    finally { enCours = false; }
  };
  void tour();
  const t = window.setInterval(() => void tour(), periodeMs);
  return () => clearInterval(t);
}
