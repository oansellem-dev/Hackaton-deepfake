import { useState, type ChangeEvent, type FormEvent } from "react";
import { actions, aujourdhui, recruteur, useEtat } from "../store/store";
import { envoyerPreVerif, apercuEmail } from "../store/envoi";
import { composerEmail } from "../store/email";
import { debutJour, isoDate, plusJours } from "../store/format";
import { Btn, Field, Input, Select } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcMail } from "../ui/icons";
import { CREER, Logo, NOMS, fournisseurDe, lienValide } from "../ui/visio";
import { Manta } from "../manta/Manta";

export const POSTES = ["Développeuse front-end", "Développeur back-end", "Développeur full-stack", "Développeur mobile", "Designer UI/UX", "Architecte cloud", "Data analyst", "Cheffe de produit", "Ingénieure QA", "Rédactrice"];

interface F { nom: string; email: string; poste: string; date: string; heure: string; visio: string }

/** Création d'un entretien. Réutilisé par la fenêtre « Nouvel entretien » et l'écran Entretiens. */
export function NouvelEntretienForm({ onDone, initial }: { onDone?: (id: string) => void; initial?: { date: string; heure: string } }) {
  const etat = useEtat();
  const [f, setF] = useState<F>(() => ({ nom: "", email: "", poste: POSTES[0], date: initial?.date ?? isoDate(plusJours(debutJour(aujourdhui(etat)), 1)), heure: initial?.heure ?? "10:00", visio: "" }));
  const [err, setErr] = useState<Partial<Record<keyof F, string>>>({});
  const set = (k: keyof F) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); if (err[k]) setErr({ ...err, [k]: undefined }); };

  const valider = (): Date | null => {
    const e: Partial<Record<keyof F, string>> = {};
    if (f.nom.trim().split(/\s+/).filter(Boolean).length < 2) e.nom = "Indiquez le prénom et le nom.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Cet e-mail ne semble pas valide.";
    if (!f.date) e.date = "Choisissez une date.";
    if (!f.heure) e.heure = "Choisissez une heure.";
    const quand = new Date(`${f.date}T${f.heure || "00:00"}`);
    if (!e.date && !e.heure && quand.getTime() < Date.now()) e.date = "Cette date est déjà passée.";
    if (f.visio.trim() && !lienValide(f.visio)) e.visio = "Collez un lien complet (https://…).";
    setErr(e);
    return Object.keys(e).length ? null : quand;
  };
  const creer = (lien: boolean) => {
    const quand = valider();
    if (!quand) return;
    const [prenom, ...reste] = f.nom.trim().split(/\s+/);
    const x = actions.creerEntretien({ prenom, nom: reste.join(" "), email: f.email.trim(), poste: f.poste, date: quand.toISOString(), visio: f.visio.trim() || undefined }, false);
    toast(lien ? `Entretien créé pour ${prenom}` : `Entretien créé pour ${prenom}, sans pré-vérification`);
    if (lien) void envoyerPreVerif(x.id);
    setF({ ...f, nom: "", email: "", visio: "" });
    onDone?.(x.id);
  };
  const prenom = f.nom.trim().split(/\s+/)[0];
  const voirEmail = () => {
    const d = new Date(`${f.date}T${f.heure || "10:00"}`);
    apercuEmail(composerEmail({ prenom: prenom || "Camille", to: f.email.trim() || "candidat@exemple.fr", poste: f.poste, date: (isNaN(+d) ? new Date() : d).toISOString(), recruteur: recruteur(etat, etat.moi).nom, token: "apercu", relance: false, objet: etat.reglages.textesLien.objet, intro: etat.reglages.textesLien.intro }));
  };

  return (
    <form className="nouvel" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); creer(true); }}>
      <Field label="Candidat" error={err.nom}><Input value={f.nom} onChange={set("nom")} placeholder="Prénom Nom" autoFocus error={!!err.nom} /></Field>
      <Field label="E-mail" error={err.email}><Input type="email" value={f.email} onChange={set("email")} placeholder="prenom.nom@exemple.fr" error={!!err.email} /></Field>
      <Field label="Poste"><Select value={f.poste} onChange={set("poste")}>{POSTES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
      <div className="nouvel__2">
        <Field label="Date" error={err.date}><Input type="date" value={f.date} onChange={set("date")} error={!!err.date} /></Field>
        <Field label="Heure" error={err.heure}><Input type="time" value={f.heure} onChange={set("heure")} error={!!err.heure} /></Field>
      </div>
      <Field label="Visio (Google Meet, Zoom, Teams)" error={err.visio} hint={f.visio.trim() ? `Le bouton « Rejoindre » ouvrira ${NOMS[fournisseurDe(f.visio)]}.` : "Facultatif : créez la réunion puis collez son lien. Oval ne fait aucun appel lui-même."}>
        <Input value={f.visio} onChange={set("visio")} placeholder="https://meet.google.com/abc-defg-hij" error={!!err.visio} />
      </Field>
      <div className="row wrap nouvel__visios" style={{ gap: 8 }}>
        {CREER.map((c) => <Btn key={c.id} size="sm" variant="ghost" icon={<Logo f={c.id} />} href={c.url} newTab>Créer sur {NOMS[c.id]}</Btn>)}
      </div>
      <div className="card nouvel__info">
        <Manta size={48} />
        <div><strong>Ce que recevra {prenom || "le candidat"}</strong><p className="t-small muted">Un lien de 2 minutes : accord, test de lumière, un geste. Aucune vidéo enregistrée. Il peut refuser sans que ça compte contre lui.</p><button type="button" className="btn btn--ghost btn--sm nouvel__voir" onClick={voirEmail}>Voir l'e-mail</button></div>
      </div>
      <Btn type="submit" variant="primary" size="lg" block icon={<IcMail />}>Envoyer le lien de pré-vérification</Btn>
      <Btn block onClick={() => creer(false)}>Créer sans pré-vérification</Btn>
    </form>
  );
}
