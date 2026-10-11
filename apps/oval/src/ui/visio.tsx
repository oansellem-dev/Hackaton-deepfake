import { useState } from "react";
import type { Entretien } from "../store/types";
import { actions } from "../store/store";
import { Btn, Pop } from "./ui";
import { toast } from "./toast";
import { IcArrowUR, IcPlay, IcX } from "./icons";

/**
 * Visio externe : Oval ne fait aucun appel lui-même. Chaque entretien porte le lien de sa réunion
 * (Google Meet, Zoom, Teams…) et « Rejoindre » l'ouvre dans un nouvel onglet. L'extension Oval
 * s'ouvre ensuite à côté de la visio.
 */
export type Fournisseur = "meet" | "zoom" | "teams" | "autre";
export const NOMS: Record<Fournisseur, string> = { meet: "Google Meet", zoom: "Zoom", teams: "Teams", autre: "la visio" };
/** Pages de création d'une réunion instantanée. */
export const CREER: { id: Fournisseur; url: string }[] = [
  { id: "meet", url: "https://meet.google.com/new" },
  { id: "zoom", url: "https://zoom.us/start/videomeeting" },
  { id: "teams", url: "https://teams.microsoft.com/l/meeting/new" },
];

export function fournisseurDe(url: string): Fournisseur {
  const u = url.toLowerCase();
  if (u.includes("meet.google.")) return "meet";
  if (u.includes("zoom.")) return "zoom";
  if (u.includes("teams.")) return "teams";
  return "autre";
}
export const lienValide = (url: string) => /^https?:\/\/\S+\.\S+/.test(url.trim());

/* Petits logos monochromes (couleur du texte) */
export const IcMeet = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="6" width="12" height="12" rx="3" /><path d="M15 10l6-3v10l-6-3z" /></svg>;
export const IcZoom = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><rect x="7" y="9.5" width="7" height="5" rx="1.5" /><path d="M14 11.5l3-1.5v4l-3-1.5z" /></svg>;
export const IcTeams = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="7" width="11" height="11" rx="3" /><path d="M6.5 11h4M8.5 11v4" /><circle cx="18" cy="9" r="2" /><path d="M16 13h3a2 2 0 0 1 2 2v2h-4" /></svg>;
export const Logo = ({ f }: { f: Fournisseur }) => (f === "meet" ? <IcMeet /> : f === "zoom" ? <IcZoom /> : f === "teams" ? <IcTeams /> : <IcPlay />);

/** Bouton « Rejoindre » : ouvre la réunion si le lien existe, sinon propose d'en créer une ou d'en coller une. */
export function BtnRejoindre({ x, size, variant = "now", block, court }: { x: Entretien; size?: "sm" | "md" | "lg"; variant?: "now" | "glass" | "secondary" | "primary"; block?: boolean; court?: boolean }) {
  if (x.visio) {
    const f = x.visio.fournisseur;
    return <Btn size={size} variant={variant} block={block} icon={<Logo f={f} />} href={x.visio.url} newTab>{court ? "Rejoindre" : `Rejoindre avec ${NOMS[f]}`}</Btn>;
  }
  return (
    <Pop align="left" width={300} button={({ open, toggle }) => <Btn size={size} variant={variant === "now" ? "secondary" : variant} block={block} icon={<IcPlay />} onClick={toggle} aria-expanded={open}>{court ? "Visio" : "Choisir la visio"}</Btn>}>
      {(close) => <MenuVisio x={x} close={close} />}
    </Pop>
  );
}

function MenuVisio({ x, close }: { x: Entretien; close: () => void }) {
  const [url, setUrl] = useState("");
  const coller = () => {
    if (!lienValide(url)) { toast("Collez un lien complet, par exemple https://meet.google.com/abc-defg-hij"); return; }
    actions.definirVisio(x.id, url.trim());
    toast(`Lien ${NOMS[fournisseurDe(url)]} enregistré pour ${x.candidat.prenom}`);
    close();
  };
  return (
    <>
      <div className="menu__title">Créer la réunion</div>
      {CREER.map((c) => (
        <a key={c.id} className="menu__item" href={c.url} target="_blank" rel="noreferrer" onClick={() => toast(`Copiez ensuite le lien ${NOMS[c.id]} et collez-le ici`)}><Logo f={c.id} />{NOMS[c.id]}<IcArrowUR width={14} height={14} style={{ marginLeft: "auto", opacity: .6 }} /></a>
      ))}
      <div className="menu__title">Ou coller un lien existant</div>
      <form className="visio__coller" onSubmit={(e) => { e.preventDefault(); coller(); }}>
        <input className="field__ctl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meet.google.com/…" aria-label="Lien de la visio" autoFocus />
        <Btn size="sm" variant="primary" type="submit">Enregistrer</Btn>
      </form>
    </>
  );
}

/** Ligne « Visio » d'une fiche : lien actuel, changement, retrait. */
export function LigneVisio({ x }: { x: Entretien }) {
  if (!x.visio) return <BtnRejoindre x={x} size="sm" variant="secondary" />;
  const f = x.visio.fournisseur;
  return (
    <span className="visio__ligne">
      <Btn size="sm" variant="now" icon={<Logo f={f} />} href={x.visio.url} newTab>Rejoindre avec {NOMS[f]}</Btn>
      <button type="button" className="icirc icirc--sm" title="Retirer le lien de visio" aria-label="Retirer le lien de visio" onClick={() => { actions.definirVisio(x.id, undefined); toast("Lien de visio retiré"); }}><IcX /></button>
    </span>
  );
}
