import { useState, type CSSProperties, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { aujourdhui, memeJour, nomComplet, useEtat } from "../store/store";
import { jourCourt, plage, relatif } from "../store/format";
import { statutEntretien } from "../store/statuts";
import { Btn, Pill, Vide, transition, type Ton } from "../ui/ui";
import { IcArrowUR, IcMail, IcPlus, IcRefresh } from "../ui/icons";
import { BtnRejoindre } from "../ui/visio";
import { aller } from "../app/router";
import { ouvrirNouvelEntretien } from "../app/events";
import { MantaAsk } from "./MantaAsk";
import { Calendrier, CalendrierApercu } from "./Calendrier";
import { envoyerPreVerif } from "../store/envoi";
import { t } from "../i18n";
import "./accueil.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const parDate = (p: Entretien, q: Entretien) => +new Date(p.date) - +new Date(q.date);
const rapport = (x: Entretien) => aller(`#/rapport/${x.id}`);

/** Le calendrier reste ouvert pendant la navigation interne, et se replie à chaque chargement de page. */
let calendrierOuvert = false;

export function Accueil() {
  const etat = useEtat();
  const ref = aujourdhui(etat);
  const [ouvert, setOuvert] = useState(calendrierOuvert);
  const basculer = (o: boolean) => transition(() => { calendrierOuvert = o; setOuvert(o); });
  return (
    <div className="accueil">
      {ouvert ? <Calendrier onReduire={() => basculer(false)} /> : <CalendrierApercu onOuvrir={() => basculer(true)} />}
      <div className="accueil__bas">
        <Aujourdhui ref_={ref} />
        <MantaAsk />
      </div>
    </div>
  );
}

/* ── Entretiens du jour ─────────────────────────────────────── */
function Aujourdhui({ ref_ }: { ref_: Date }) {
  const etat = useEtat();
  const duJour = etat.entretiens.filter((x) => memeJour(new Date(x.date), ref_)).sort(parDate);
  const suite = duJour.length < 3 ? etat.entretiens.filter((x) => x.statut !== "termine" && new Date(x.date) > ref_ && !memeJour(new Date(x.date), ref_)).sort(parDate).slice(0, 3 - duJour.length) : [];
  const enAvant = duJour.find((x) => x.statut !== "termine" && new Date(x.date).getTime() + x.dureeMin * 60000 > ref_.getTime());
  return (
    <section className="panel bloc rise" style={v({ "--i": 2 })}>
      <div className="bloc__head"><h2 className="t-h2">{t("Aujourd'hui")}</h2><Btn size="sm" variant="ghost" icon={<IcArrowUR />} href="#/entretiens?filtre=aujourdhui">{t("Tout voir")}</Btn></div>
      <div className="auj">
        {!duJour.length && <Vide titre={t("Aucun entretien aujourd'hui.")} texte={t("Les prochains sont listés ci-dessous.")} />}
        {duJour.map((x) => <CarteJour key={x.id} x={x} ref_={ref_} enAvant={x.id === enAvant?.id} />)}
        {suite.length > 0 && <div className="auj__sep">{t("Prochainement")}</div>}
        {suite.map((x) => <CarteJour key={x.id} x={x} ref_={ref_} enAvant={false} />)}
        {!duJour.length && !suite.length && <Btn variant="primary" icon={<IcPlus />} onClick={ouvrirNouvelEntretien}>{t("Nouvel entretien")}</Btn>}
      </div>
    </section>
  );
}

function CarteJour({ x, ref_, enAvant }: { x: Entretien; ref_: Date; enAvant: boolean }) {
  const p = x.preVerification;
  const auj = memeJour(new Date(x.date), ref_);
  const termine = x.statut === "termine";
  const pv = p.statut === "faite" ? t("pré-vérification faite")
    : p.refuseeLe ? t("pré-vérification refusée, défis en direct")
    : termine || auj ? t("pré-vérification non faite, défis en direct")
    : p.statut === "non_envoyee" ? t("lien pas encore envoyé")
    : t("lien envoyé {quand}", { quand: relatif(p.relanceeLe ?? p.envoyeeLe ?? x.creeLe, ref_).toLowerCase() });
  const st = statutEntretien(x, ref_);
  const coin = termine ? st.texte : auj ? relatif(x.date, ref_) : jourCourt(x.date);
  const coinTon: Ton = enAvant ? "white" : termine ? (st.ton === "gold" ? "soft-gold" : st.ton === "green" ? "soft-green" : "neutral") : auj ? "soft-blue" : "neutral";
  let action: ReactNode;
  if (termine) action = <Btn size="sm" icon={<IcArrowUR />} onClick={() => rapport(x)}>{t("Ouvrir le rapport")}</Btn>;
  else if (enAvant) action = <BtnRejoindre x={x} size="sm" variant="glass" />;
  else if (p.statut === "non_envoyee") action = <Btn size="sm" icon={<IcMail />} onClick={() => void envoyerPreVerif(x.id)}>{t("Envoyer le lien")}</Btn>;
  else if (p.statut !== "faite") action = <Btn size="sm" icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>{t("Relancer le lien")}</Btn>;
  else action = auj ? <BtnRejoindre x={x} size="sm" variant="secondary" /> : <Btn size="sm" icon={<IcArrowUR />} onClick={() => rapport(x)}>{t("Voir la fiche")}</Btn>;
  return (
    <article className={`card auj__card${enAvant ? " auj__card--now" : " lift"}`}>
      <div className="auj__top">
        <a className="auj__nom" href={`#/rapport/${x.id}`}>{nomComplet(x)}</a>
        <Pill ton={coinTon} dot>{coin}</Pill>
      </div>
      <p className="auj__desc">{x.candidat.poste} · {pv}</p>
      <div className="auj__actions">
        <Pill ton={enAvant ? "white" : "neutral"}>{plage(x.date, x.dureeMin)}</Pill>
        {action}
      </div>
    </article>
  );
}
