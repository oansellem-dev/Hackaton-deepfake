import { useRef, useState, type CSSProperties } from "react";
import { nomComplet, recruteur, useEtat } from "../store/store";
import { ACTIONS_RAPIDES, interpreter, type Reponse } from "../store/manta-commands";
import { Manta, type MantaState } from "../manta/Manta";
import { BorderBeam } from "@kyc/design";
import { Btn, ICirc, Pop } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowR, IcFlag, IcList, IcMail, IcPlus, IcX } from "../ui/icons";
import { ouvrirNouvelEntretien } from "../app/events";
import { t } from "../i18n";

const MAX = 300;

/** Bloc Manta de l'accueil : salutation, actions rapides, champ « Demande à Manta ». */
export function MantaAsk() {
  const etat = useEtat();
  const [texte, setTexte] = useState("");
  const [rep, setRep] = useState<Reponse | null>(null);
  const [mstate, setMstate] = useState<MantaState>("neutre");
  const zone = useRef<HTMLTextAreaElement>(null);
  const prenom = recruteur(etat, etat.moi).nom.split(" ")[0];
  const noms = [...new Set(etat.entretiens.map(nomComplet))].sort((a, b) => a.localeCompare(b, "fr"));

  const inserer = (s: string) => { setTexte((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${s} `.slice(0, MAX)); requestAnimationFrame(() => zone.current?.focus()); };
  const envoyer = () => {
    const demande = texte.trim();
    if (!demande) { setRep({ comprise: false, message: t("Écris ce que tu veux vérifier, ou choisis une action :"), suggestions: ACTIONS_RAPIDES(etat) }); return; }
    setMstate("analyse");
    const r = interpreter(demande, etat);
    window.setTimeout(() => {
      setRep(r);
      setMstate(r.comprise ? "verifie" : "neutre");
      if (r.comprise && r.executer) {
        const go = r.executer;
        toast(r.message);
        setTexte("");
        window.setTimeout(() => { go(); setMstate("neutre"); }, 650);
      }
    }, 380);
  };

  return (
    <section className="panel bloc manta-bloc rise" style={{ "--i": 4 } as CSSProperties}>
      <Manta state={mstate} size={124} title="Manta" />
      <h2 className="manta-bloc__hello">{t("Bonjour {prenom},", { prenom })}<br />{t("que veux-tu vérifier aujourd'hui ?")}</h2>
      <div className="manta-bloc__chips">
        <Btn size="sm" icon={<IcMail />} onClick={ouvrirNouvelEntretien}>{t("Envoyer un lien")}</Btn>
        <Btn size="sm" icon={<IcList />} href="#/entretiens?filtre=termines">{t("Voir les rapports")}</Btn>
        <Btn size="sm" icon={<IcFlag />} href="#/entretiens?filtre=signal">{t("Signaux à vérifier")}</Btn>
      </div>
      {rep && (
        <div className="card reponse pop" role="status">
          <div className="reponse__top"><span>{rep.message}</span><button type="button" className="icirc icirc--sm" aria-label={t("Fermer la réponse")} onClick={() => setRep(null)}><IcX /></button></div>
          {rep.suggestions && <div className="row wrap" style={{ gap: 8 }}>{rep.suggestions.map((s) => <Btn key={s.libelle} size="sm" onClick={() => { setRep(null); s.executer(); }}>{s.libelle}</Btn>)}</div>}
        </div>
      )}
      <BorderBeam>
      <form className="card ask" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
        <label className="sr-only" htmlFor="demande-manta">{t("Demande à Manta")}</label>
        <textarea id="demande-manta" ref={zone} rows={2} maxLength={MAX} value={texte} placeholder={t("Demande à Manta… ex. « Envoie un lien à Camille Royer »")}
          onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }} />
        <div className="ask__bar">
          <Pop up width={250} button={({ open, toggle }) => <Btn size="sm" variant="inset" icon={<IcPlus />} onClick={toggle} aria-expanded={open}>{t("Candidat")}</Btn>}>
            {(close) => <><div className="menu__title">{t("Insérer un candidat")}</div><div className="menu__scroll">{noms.map((n) => <button key={n} type="button" className="menu__item" onClick={() => { inserer(n); close(); }}>{n}</button>)}</div></>}
          </Pop>
          <Btn size="sm" variant="inset" icon={<IcList />} onClick={() => inserer("Ouvre le rapport de")}>{t("Rapport")}</Btn>
          <span className="ask__count" aria-live="polite">{texte.length}/{MAX}</span>
          <ICirc size="sm" label={t("Envoyer à Manta")} type="submit"><IcArrowR /></ICirc>
        </div>
      </form>
      </BorderBeam>
    </section>
  );
}
