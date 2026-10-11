/**
 * Envoi (ou relance) du lien de pré-vérification.
 * Crée un lien unique, valable jusqu'au début de l'entretien, met à jour le statut,
 * puis envoie l'e-mail. Sans SMTP configuré, ouvre la fenêtre « E-mail prêt à partir ».
 */
import type { PreVerification } from "./types";
import { actions, getEtat, parId, recruteur } from "./store";
import { composerEmail, envoyerEmail, type Email } from "./email";
import { toast } from "../ui/toast";
import { creerSession, modeMoteur } from "./moteur";

export type DetailEmail = { mode: "apercu" } | { mode: "manuel"; raison: string; entretienId: string; prev: PreVerification };
export interface EvenementEmail { email: Email; detail: DetailEmail }

const jeton = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
const signaler = (e: EvenementEmail) => window.dispatchEvent(new CustomEvent<EvenementEmail>("oval:email", { detail: e }));

export async function envoyerPreVerif(id: string, relance = false): Promise<void> {
  const etat = getEtat();
  const x = parId(etat, id);
  if (!x) return;
  const prev = x.preVerification;
  // Mode moteur : la session est créée côté serveur, qui fournit le jeton du lien (/check/<jeton> sur le site du moteur).
  let moteur = x.moteur;
  if (!moteur && modeMoteur()) {
    try { moteur = await creerSession(x); } catch (e) { toast(`Moteur injoignable, lien de démo utilisé (${e instanceof Error ? e.message : e})`); }
  }
  const lienMoteur = moteur?.lienToken ? parId(getEtat(), id)?.preVerification.lien : undefined;
  const encoreValide = prev.lien && new Date(prev.lien.expireLe).getTime() > Date.now() ? prev.lien : undefined;
  const lien = lienMoteur ?? encoreValide ?? { token: jeton(), expireLe: x.date };
  const estRelance = relance && prev.statut !== "non_envoyee";
  actions.marquerLienEnvoye(id, lien, estRelance);

  const email = composerEmail({
    prenom: x.candidat.prenom, to: x.candidat.email, poste: x.candidat.poste, date: x.date,
    recruteur: recruteur(etat, x.recruteurId).nom, token: lien.token, relance: estRelance, moteur: !!lienMoteur,
    objet: etat.reglages.textesLien.objet, intro: etat.reglages.textesLien.intro,
  });
  const r = await envoyerEmail(email);
  if (r.mode === "envoye") toast(`E-mail ${estRelance ? "de rappel " : ""}envoyé à ${x.candidat.prenom} (${x.candidat.email})`);
  else if (r.mode === "test") toast("Mode test : e-mail enregistré dans outbox/, rien n'est parti");
  else signaler({ email, detail: { mode: "manuel", raison: r.raison, entretienId: id, prev } });
}

export const apercuEmail = (email: Email) => signaler({ email, detail: { mode: "apercu" } });
