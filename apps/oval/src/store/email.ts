/**
 * E-MAIL DE PRÉ-VÉRIFICATION — rédaction, envoi, repli.
 * L'envoi passe par /api/email (serveur de dev, voir server/email.ts).
 * Sans configuration SMTP, l'interface propose d'ouvrir la messagerie du recruteur
 * avec l'e-mail déjà rédigé (lien mailto).
 */
import { heure, jourLong } from "./format";

export interface Email { to: string; subject: string; html: string; text: string; lien: string }
export interface DonneesEmail { prenom: string; to: string; poste: string; date: string; recruteur: string; token: string; relance: boolean; objet: string; intro: string; /** true : lien vers la page candidat du moteur (/check/<jeton>) */ moteur?: boolean }
export type ResultatEnvoi = { mode: "envoye" } | { mode: "test" } | { mode: "manuel"; raison: string };

/** Adresse de la page candidat : VITE_PUBLIC_URL si elle est définie, sinon l'adresse actuelle. */
export const baseUrl = () => (import.meta.env.VITE_PUBLIC_URL ?? "").replace(/\/+$/, "") || location.origin;
export const lienCandidat = (token: string) => `${baseUrl()}/#/candidat/${token}`;
/** Adresse du site du moteur (pages candidat, visio, panneau) : VITE_MOTEUR_URL, sinon http://localhost:5173. */
export const moteurUrl = () => (import.meta.env.VITE_MOTEUR_URL ?? "http://localhost:5173").trim().replace(/\/+$/, "");
/** Lien candidat du moteur : /check/<jeton>, pré-vérification réelle (identité, Face ID, reflet de l'écran). */
export const lienCandidatMoteur = (token: string) => `${moteurUrl()}/check/${token}`;

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENT[c] ?? c);
const VERIFIE = ["Votre caméra et votre connexion", "La lumière de l'écran sur votre visage : quelques secondes de couleurs douces, sans flash", "Un geste simple de la main"];
const JAMAIS = ["Aucune vidéo enregistrée", "Aucune pièce d'identité demandée", "Aucune analyse de vos émotions"];

export function composerEmail(d: DonneesEmail): Email {
  const lien = d.moteur ? lienCandidatMoteur(d.token) : lienCandidat(d.token);
  const quand = `${jourLong(d.date)} à ${heure(d.date)}`;
  const intro = d.intro.replace(/\{prenom\}/g, d.prenom);
  const subject = `${d.relance ? "Rappel : " : ""}${d.objet}`;
  const rappel = "Petit rappel : votre vérification n'est pas encore faite.";
  const refus = `Vous pouvez refuser ou passer une étape : cela ne joue pas contre vous, ${d.recruteur} vous proposera une autre solution.`;
  const validite = "Lien personnel, valable une fois, jusqu'au début de l'entretien.";

  const text = [
    ...(d.relance ? [rappel, ""] : []),
    intro, "",
    `Votre entretien : ${quand} · ${d.poste}, avec ${d.recruteur}.`, "",
    "Commencer la vérification (2 min) :", lien, "À ouvrir sur l'ordinateur que vous utiliserez pour l'entretien.", "",
    `Ce qui est vérifié : ${VERIFIE.join(" ; ").toLowerCase()}.`,
    `Ce que nous ne faisons pas : ${JAMAIS.join(" ; ").toLowerCase()}.`, "",
    refus, validite, "",
    `${d.recruteur}, avec Oval`,
  ].join("\n");

  const li = (t: string, signe: string) => `<tr><td style="padding:3px 10px 3px 0;vertical-align:top;color:#46506b;">${signe}</td><td style="padding:3px 0;">${esc(t)}</td></tr>`;
  const bloc = (titre: string, items: string[], signe: string) =>
    `<p style="margin:0 0 6px;font-weight:700;font-size:14px;">${titre}</p><table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.45;margin:0 0 14px;">${items.map((t) => li(t, signe)).join("")}</table>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#e9ecf3;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif;color:#1b2032;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Deux minutes pour vérifier votre caméra avant l'entretien du ${esc(quand)}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9ecf3;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#f9fafd;border-radius:28px;box-shadow:0 12px 32px rgba(62,74,110,.14);">
<tr><td style="padding:30px 32px 6px;"><img src="${moteurUrl()}/oval-logo.png" width="13" height="26" alt="" style="display:inline-block;vertical-align:middle;border:0;"><span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;margin-left:8px;color:#222;">Oval</span></td></tr>
<tr><td style="padding:16px 32px 0;font-size:16px;line-height:1.55;">
${d.relance ? `<p style="margin:0 0 12px;color:#5c3a00;font-weight:700;">${rappel}</p>` : ""}
<p style="margin:0 0 16px;">${esc(intro)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8ebf2;border-radius:16px;"><tr><td style="padding:14px 18px;font-size:14px;line-height:1.5;"><strong>Votre entretien</strong><br>${esc(quand)} · ${esc(d.poste)}<br>avec ${esc(d.recruteur)}</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:26px 32px 6px;">
<a href="${esc(lien)}" style="display:inline-block;background:#1b2032;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:16px 28px;border-radius:999px;">Commencer la vérification (2 min)</a>
<p style="margin:12px 0 0;font-size:13px;color:#46506b;">À ouvrir sur l'ordinateur que vous utiliserez pour l'entretien.</p>
</td></tr>
<tr><td style="padding:22px 32px 0;">${bloc("Ce qui est vérifié", VERIFIE, "✓")}${bloc("Ce que nous ne faisons pas", JAMAIS, "✕")}</td></tr>
<tr><td style="padding:2px 32px 0;font-size:14px;line-height:1.5;color:#46506b;">${esc(refus)}</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12.5px;line-height:1.5;color:#5e6880;">${validite}<br>Si le bouton ne fonctionne pas, copiez ce lien : <a href="${esc(lien)}" style="color:#1f45b8;word-break:break-all;">${esc(lien)}</a></td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#5e6880;">Envoyé par ${esc(d.recruteur)} avec Oval · Un vrai visage derrière chaque écran.</p>
</td></tr></table></body></html>`;
  return { to: d.to, subject, html, text, lien };
}

export async function envoyerEmail(m: Email): Promise<ResultatEnvoi> {
  try {
    const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: m.to, subject: m.subject, html: m.html, text: m.text }) });
    const j = (await r.json().catch(() => ({}))) as { test?: boolean; erreur?: string };
    if (r.ok) return j.test ? { mode: "test" } : { mode: "envoye" };
    return { mode: "manuel", raison: j.erreur ?? `erreur ${r.status}` };
  } catch {
    return { mode: "manuel", raison: "serveur d'envoi injoignable" };
  }
}

/** Repli : ouvre la messagerie du recruteur avec l'e-mail déjà rédigé. */
export const mailto = (m: Email) => `mailto:${m.to}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text)}`;
