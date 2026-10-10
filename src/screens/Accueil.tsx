import { useState, type CSSProperties, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { actions, aujourdhui, initiales, memeJour, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { debutJour, estWE, heure, jourCourt, jourNom, lundi, plage, plusJours, relatif, semaineDu } from "../store/format";
import { statutEntretien, statutPreVerif } from "../store/statuts";
import { Avatar, Bar, Btn, Pill, Pop, Vide, transition, type BarTon, type Ton } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowUR, IcCal, IcCheck, IcChevron, IcClock, IcDots, IcFilter, IcFlag, IcMail, IcPlay, IcPlus, IcRefresh, IcX } from "../ui/icons";
import { aller } from "../app/router";
import { ouvrirNouvelEntretien } from "../app/events";
import { MantaAsk } from "./MantaAsk";
import { envoyerPreVerif } from "../store/envoi";
import "./accueil.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const JOUR = 86400000;
const NB_JOURS = 14;
const idx = (d: string | Date, start: Date) => Math.round((debutJour(new Date(d)).getTime() - start.getTime()) / JOUR);
const parDate = (p: Entretien, q: Entretien) => +new Date(p.date) - +new Date(q.date);
const rapport = (x: Entretien) => aller(`#/rapport/${x.id}`);

/* ── Barres du planning : une par étape (pré-vérification, entretien) ── */
/** `court` : texte affiché quand la barre fait 2 ou 3 jours ; `label` + `chip` à partir de 4 jours. */
interface Barre { cle: string; a: number; b: number; ton: BarTon; label: string; court: string; chip?: string; icon: ReactNode; attention: boolean }

function barres(x: Entretien, start: Date, ref: Date): Barre[] {
  const out: Barre[] = [];
  const t = idx(ref, start);
  const e = idx(x.date, start);
  const p = x.preVerification;
  if (p.statut !== "non_envoyee") {
    const a = idx(p.envoyeeLe ?? x.creeLe, start);
    const fait = p.statut === "faite";
    const fin = fait && p.faiteLe ? idx(p.faiteLe, start) : Math.min(t, e - 1);
    const b = Math.max(a, Math.min(fin, e - 1));
    if (a < e) {
      const sig = p.signaux.some((s) => s.resultat === "a_verifier");
      const nonFaite = !fait && (p.statut === "non_faite" || x.statut === "termine" || e < t);
      out.push({
        cle: "pre", a, b, attention: false,
        ton: sig ? "gold" : nonFaite ? "neutral" : "violet",
        label: fait ? "Pré-vérification" : "Lien envoyé",
        court: fait ? (sig ? "À vérifier" : "Pré-vérif. faite") : nonFaite ? "Non faite" : "Lien envoyé",
        chip: fait ? (sig ? "À vérifier" : p.etapes.lumiere === "passe" ? "Lumière passée" : "Faite") : p.refuseeLe ? "Refusée" : nonFaite ? "Non faite" : p.statut === "ouverte" ? "Ouvert" : p.relanceeLe ? "Relancé" : "En attente",
        icon: fait ? (sig ? <IcFlag /> : <IcCheck />) : nonFaite ? <IcDots /> : <IcArrowUR />,
      });
    }
  }
  if (x.statut === "termine") {
    const sig = nbSignauxAVerifier(x) > 0;
    const st = statutEntretien(x, ref);
    const fin = x.decision.le ? idx(x.decision.le, start) : sig ? t : e;
    out.push({ cle: "ent", a: e, b: Math.max(e, fin), ton: st.ton === "gold" ? "gold" : st.ton === "green" ? "green" : "neutral", label: "Entretien fait", court: st.texte, chip: st.texte, icon: sig ? <IcFlag /> : <IcCheck />, attention: sig && x.decision.valeur === "non_prise" });
  } else {
    out.push({ cle: "ent", a: e, b: e, ton: e === t ? "now" : "blue", label: `Entretien · ${heure(x.date)}`, court: heure(x.date), chip: e === t ? "Aujourd'hui" : undefined, icon: <IcClock />, attention: false });
  }
  return out.filter((b) => b.b >= 0 && b.a < NB_JOURS).map((b) => ({ ...b, a: Math.max(0, b.a), b: Math.min(NB_JOURS - 1, b.b) }));
}

type Filtre = "signal" | "attente" | "avenir" | "termines";
const FILTRES: { id: Filtre; label: string; test: (x: Entretien) => boolean }[] = [
  { id: "signal", label: "Signal à vérifier", test: (x) => nbSignauxAVerifier(x) > 0 },
  { id: "attente", label: "Pré-vérification en attente", test: (x) => x.statut !== "termine" && (x.preVerification.statut === "envoyee" || x.preVerification.statut === "ouverte") },
  { id: "avenir", label: "À venir", test: (x) => x.statut !== "termine" },
  { id: "termines", label: "Terminés", test: (x) => x.statut === "termine" },
];

export function Accueil() {
  const etat = useEtat();
  const ref = aujourdhui(etat);
  const [offset, setOffset] = useState(0);
  const [filtres, setFiltres] = useState<Filtre[]>([]);
  const start = plusJours(lundi(ref), offset * 7);
  const jours = Array.from({ length: NB_JOURS }, (_, i) => plusJours(start, i));
  const t = idx(ref, start);

  const lignes = etat.entretiens
    .filter((x) => !filtres.length || FILTRES.some((f) => filtres.includes(f.id) && f.test(x)))
    .map((x) => ({ x, bs: barres(x, start, ref) }))
    .filter((l) => l.bs.length)
    .sort((p, q) => parDate(p.x, q.x));
  // Un seul élément incliné par écran : le premier signal à vérifier sans décision
  let incline = false;
  for (const l of lignes) for (const b of l.bs) { if (b.attention && !incline) incline = true; else b.attention = false; }

  const basculer = (f: Filtre) => transition(() => setFiltres((fs) => (fs.includes(f) ? fs.filter((y) => y !== f) : [...fs, f])));

  return (
    <div className="accueil">
      <section className="panel planning rise" style={v({ "--i": 1 })}>
        <header className="planning__head">
          <h1 className="t-display">Entretiens à venir</h1>
          <div className="planning__tools">
            <Pop align="right" width={280} button={({ open, toggle }) => <Btn icon={<IcCal />} onClick={toggle} aria-expanded={open}>Semaine du {semaineDu(start)} <IcChevron /></Btn>}>
              {(close) => (
                <>
                  <div className="menu__title">Afficher deux semaines</div>
                  {[-2, -1, 0, 1, 2, 3].map((o) => (
                    <button key={o} type="button" className="menu__item" aria-current={o === offset} onClick={() => { transition(() => setOffset(o)); close(); }}>
                      Semaine du {semaineDu(plusJours(lundi(ref), o * 7))}{o === 0 && <span className="menu__sub">· cette semaine</span>}
                    </button>
                  ))}
                </>
              )}
            </Pop>
            <Pop align="right" width={290} button={({ open, toggle }) => <Btn icon={<IcFilter />} onClick={toggle} aria-expanded={open}>Filtrer{filtres.length > 0 && <span className="btn__count">{filtres.length}</span>}</Btn>}>
              {() => (
                <>
                  <div className="menu__title">Montrer seulement</div>
                  {FILTRES.map((f) => {
                    const on = filtres.includes(f.id);
                    return <button key={f.id} type="button" className="menu__item" aria-pressed={on} onClick={() => basculer(f.id)}><span className={`check${on ? " check--on" : ""}`}>{on && <IcCheck />}</span>{f.label}</button>;
                  })}
                  {filtres.length > 0 && <button type="button" className="menu__item" onClick={() => transition(() => setFiltres([]))}><IcX width={16} height={16} />Tout montrer</button>}
                </>
              )}
            </Pop>
            <Btn icon={<IcArrowUR />} href="#/entretiens">Tout voir</Btn>
          </div>
        </header>

        <div className="plan__scroll">
          <div className="plan">
            <div className="plan__row plan__head">
              <div className="plan__titre">Candidats</div>
              {jours.map((j, i) => (
                <div key={i} className={`daytag${i === t ? " daytag--today" : estWE(j) ? " daytag--we" : ""}`} style={{ gridColumn: i + 2 }} aria-current={i === t ? "date" : undefined}>
                  <span>{jourNom(j)}<b>{j.getDate()}</b></span>
                </div>
              ))}
            </div>
            {lignes.map(({ x, bs }, r) => (
              <div key={x.id} className="plan__row" style={v({ viewTransitionName: `ligne-${x.id}` })}>
                <button type="button" className="card lift plan__who" onClick={() => rapport(x)} title={`Ouvrir le rapport de ${nomComplet(x)}`}>
                  <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} size="sm" />
                  <span className="plan__whoTxt"><strong>{nomComplet(x)}</strong><span>{x.candidat.poste}</span></span>
                </button>
                {jours.map((j, i) => <div key={i} className={`cell${estWE(j) && i !== t ? " cell--we" : ""}`} style={{ gridColumn: i + 2, gridRow: 1 }} />)}
                {t >= 0 && t < NB_JOURS && <i className="today-mark plan__mark" style={{ gridColumn: t + 2 }} aria-hidden />}
                {bs.map((b, k) => {
                  const span = b.b - b.a + 1;
                  return (
                    <div key={b.cle} className="plan__span grow-x" style={v({ gridColumn: `${b.a + 2} / ${b.b + 3}`, "--i": r * 2 + k })}>
                      <Bar ton={b.ton} icon={b.icon} label={span >= 4 ? b.label : b.court} chip={span >= 4 ? b.chip : undefined} attention={b.attention} mode={span === 1 ? "icon" : span >= 4 ? "full" : "label"}
                        title={`${nomComplet(x)} · ${b.label}${b.chip ? ` · ${b.chip}` : ""}`} onClick={() => rapport(x)} />
                    </div>
                  );
                })}
              </div>
            ))}
            {!lignes.length && (
              <Vide titre={filtres.length ? "Aucun entretien ne correspond à ces filtres." : "Aucun entretien sur ces deux semaines."}
                action={filtres.length ? <Btn onClick={() => transition(() => setFiltres([]))}>Tout montrer</Btn> : <Btn variant="primary" icon={<IcPlus />} onClick={ouvrirNouvelEntretien}>Nouvel entretien</Btn>} />
            )}
          </div>
        </div>
      </section>

      <div className="accueil__bas">
        <Aujourdhui ref_={ref} />
        <PreVerifs ref_={ref} />
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
      <div className="bloc__head"><h2 className="t-h2">Aujourd'hui</h2><Btn size="sm" icon={<IcArrowUR />} href="#/entretiens?filtre=aujourdhui">Tout voir</Btn></div>
      <div className="auj">
        {!duJour.length && <Vide titre="Aucun entretien aujourd'hui." texte="Les prochains sont listés ci-dessous." />}
        {duJour.map((x) => <CarteJour key={x.id} x={x} ref_={ref_} enAvant={x.id === enAvant?.id} />)}
        {suite.length > 0 && <div className="auj__sep">Prochainement</div>}
        {suite.map((x) => <CarteJour key={x.id} x={x} ref_={ref_} enAvant={false} />)}
        {!duJour.length && !suite.length && <Btn variant="primary" icon={<IcPlus />} onClick={ouvrirNouvelEntretien}>Nouvel entretien</Btn>}
      </div>
    </section>
  );
}

function CarteJour({ x, ref_, enAvant }: { x: Entretien; ref_: Date; enAvant: boolean }) {
  const p = x.preVerification;
  const auj = memeJour(new Date(x.date), ref_);
  const termine = x.statut === "termine";
  const pv = p.statut === "faite" ? "pré-vérification faite"
    : p.refuseeLe ? "pré-vérification refusée, les défis se feront en direct"
    : termine || auj ? "pré-vérification non faite, les défis se feront en direct"
    : p.statut === "non_envoyee" ? "lien pas encore envoyé"
    : `lien envoyé ${relatif(p.relanceeLe ?? p.envoyeeLe ?? x.creeLe, ref_).toLowerCase()}`;
  const st = statutEntretien(x, ref_);
  const coin = termine ? st.texte : auj ? relatif(x.date, ref_) : jourCourt(x.date);
  const coinTon: Ton = enAvant ? "white" : termine ? (st.ton === "gold" ? "soft-gold" : st.ton === "green" ? "soft-green" : "neutral") : auj ? "soft-blue" : "neutral";
  const panneau = `#/visio/${x.id}`;
  let action: ReactNode;
  if (termine) action = <Btn size="sm" icon={<IcArrowUR />} onClick={() => rapport(x)}>Ouvrir le rapport</Btn>;
  else if (enAvant) action = <Btn size="sm" variant="glass" icon={<IcPlay />} href={panneau}>Rejoindre avec Oval</Btn>;
  else if (p.statut === "non_envoyee") action = <Btn size="sm" icon={<IcMail />} onClick={() => void envoyerPreVerif(x.id)}>Envoyer le lien</Btn>;
  else if (p.statut !== "faite") action = <Btn size="sm" icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>Relancer le lien</Btn>;
  else action = auj ? <Btn size="sm" icon={<IcPlay />} href={panneau}>Rejoindre avec Oval</Btn> : <Btn size="sm" icon={<IcArrowUR />} onClick={() => rapport(x)}>Voir la fiche</Btn>;
  return (
    <article className={`card auj__card${enAvant ? " auj__card--now" : " lift"}`}>
      <div className="auj__top">
        <a className="auj__nom" href={`#/rapport/${x.id}`}>{nomComplet(x)}</a>
        <Pill ton={coinTon} dot>{coin}</Pill>
      </div>
      <p className="auj__desc">{x.candidat.poste} · {pv}</p>
      <div className="auj__actions">
        <Pill ton={enAvant ? "white" : "neutral"} icon={<IcClock />}>{plage(x.date, x.dureeMin)}</Pill>
        {action}
      </div>
    </article>
  );
}

/* ── Pré-vérifications récentes ─────────────────────────────── */
const icPv = (ton: Ton) => (ton === "soft-green" ? <IcCheck /> : ton === "soft-gold" ? <IcFlag /> : ton === "soft-violet" ? <IcArrowUR /> : <IcDots />);
function PreVerifs({ ref_ }: { ref_: Date }) {
  const etat = useEtat();
  const activite = (x: Entretien) => +new Date(x.preVerification.faiteLe ?? x.preVerification.relanceeLe ?? x.preVerification.envoyeeLe ?? x.creeLe);
  const liste = etat.entretiens.filter((x) => x.statut !== "termine" && x.preVerification.statut !== "non_envoyee").sort((p, q) => activite(q) - activite(p)).slice(0, 4);
  return (
    <section className="panel bloc rise" style={v({ "--i": 3 })}>
      <div className="bloc__head"><h2 className="t-h2">Pré-vérifications</h2><Btn size="sm" icon={<IcArrowUR />} href="#/entretiens?filtre=preverif">Tout voir</Btn></div>
      {!liste.length ? <Vide titre="Aucune pré-vérification en cours." texte="Envoyez un lien depuis « Nouvel entretien »." /> : (
        <div className="pv-grid">
          {liste.map((x) => {
            const s = statutPreVerif(x, ref_);
            return (
              <button key={x.id} type="button" className="card lift pv-card" onClick={() => rapport(x)} title={`Ouvrir la fiche de ${nomComplet(x)}`}>
                <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} size="lg" />
                <strong>{nomComplet(x)}</strong>
                <span className="t-small muted">{x.candidat.poste}</span>
                <Pill ton={s.ton} icon={icPv(s.ton)}>{s.texte}</Pill>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
