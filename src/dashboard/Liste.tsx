import { useEffect, useMemo, useState } from "react";
import type { Entretien } from "../shared/types";
import { getEntretiens } from "../shared/api";
import { DEFI_NOMS, PREVERIF_STATUTS } from "../shared/texts";
import { heure, quand } from "../shared/format";
import { Statut } from "./Statut";
import { useCountUp } from "./useCountUp";
import { useParallax } from "./useParallax";
import { Courbe, Jauge } from "./charts";
import { IcArrowL, IcArrowR, IcCam, IcCheck, IcChevron, IcClock, IcHeadset, IcHelp, IcMic, IcPlay, IcPlus, IcPulse, IcSpark, IcWifi } from "./icons";

const I = ({ children, s = 18 }: { children: React.ReactNode; s?: number }) => <span style={{ width: s, height: s, display: "inline-flex" }}>{children}</span>;

export function Liste() {
  const [liste, setListe] = useState<Entretien[]>([]);
  const [sel, setSel] = useState(0);
  const [onglet, setOnglet] = useState<"total" | "verifiees" | "signaux">("verifiees");
  useEffect(() => { getEntretiens().then(setListe); }, []);
  useParallax();

  const aujourdhui = useMemo(() => liste.filter((e) => e.statut !== "termine"), [liste]);
  const termines = liste.filter((e) => e.statut === "termine");
  const signaux = liste.reduce((n, e) => n + e.preVerification.signaux.length + (e.score?.signaux.length ?? 0), 0);
  const series = {
    verifiees: [2, 9, 14, 11, 19, 16, 24, 22, 31],
    total: [4, 12, 16, 15, 22, 21, 28, 27, 35],
    signaux: [1, 2, 3, 2, 4, 3, 4, 3, 4],
  };
  const nbCourbe = useCountUp(series[onglet][series[onglet].length - 1]);
  const courant = aujourdhui[sel] ?? aujourdhui[0];
  const dernier = termines[0];
  const n = aujourdhui.length;

  return (
    <>
      <div className="photo" aria-hidden><img src="/img/hero.jpg" alt="" data-depth="-10" /></div>
      <div className="dots" aria-hidden data-depth="6" />

      <div className="body">
        <div className="dgrid">
          {/* Progression */}
          <section className="card progress-card rise">
            <div className="card__head">
              <h2 className="card__title">Progression</h2>
              <span className="card__meta">Période <b>2026</b> <IcChevron /></span>
            </div>
            <div className="chart">
              <Courbe height={400} serie={series[onglet]} serie2={series.total.map((v) => v * .55)} serie3={series.signaux.map((v) => v * 3.5)} />
              <div className="chart__num"><span className="dot-num">{nbCourbe}</span><span>+103 %</span></div>
            </div>
            <div className="chart__tabs" role="tablist">
              <button aria-pressed={onglet === "total"} onClick={() => setOnglet("total")}>Total</button>
              <button aria-pressed={onglet === "verifiees"} onClick={() => setOnglet("verifiees")}>Vérifiées</button>
              <button aria-pressed={onglet === "signaux"} onClick={() => setOnglet("signaux")}>Signaux</button>
            </div>
          </section>

          {/* Fiabilité */}
          <section className="card rise">
            <div className="card__head">
              <h2 className="card__title">Fiabilité</h2>
              <a className="rbtn rbtn--dark" href={dernier ? `#/rapport/${dernier.id}` : "#/rapports"} style={{ width: 26, height: 26 }} aria-label="Voir le rapport"><I s={12}><IcPlus /></I></a>
            </div>
            <Jauge valeur={dernier?.score?.valeur ?? 0} />
            <p className="small muted" style={{ textAlign: "center", marginTop: 6 }}>{dernier ? `${dernier.candidat.prenom} ${dernier.candidat.nom} · consultatif` : "—"}</p>
          </section>

          {/* Planning */}
          <section className="card rise">
            <div className="card__head">
              <h2 className="card__title">Planning</h2>
              <span className="card__meta">Poste <b>Full-stack</b> <IcChevron /></span>
            </div>
            <div className="week"><b>Semaine 1</b><span className="week__line" /><span>6 – 10 oct.</span></div>
            <div className="days">
              {[0, 1, 2, 3].map((i) => <span key={i} className="day" title="Entretien fait"><i><IcCheck /></i></span>)}
              <span className="day day--now" title="Aujourd'hui"><I s={16}><IcSpark /></I></span>
            </div>
            <div className="week"><span>Semaine 2</span><span className="week__line" /><span>13 – 17 oct.</span></div>
            <div className="days">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="day day--todo" />)}</div>
          </section>

          {/* Média */}
          <section className="card media media-card rise">
            <img src="/img/media.jpg" alt="" />
            <span className="media__time"><IcClock /> 2 min</span>
            <p className="media__title">Pré-vérification : lumière, geste, signaux</p>
            <a className="btn btn--primary btn--sm" href="#/pre-verifications">Envoyer un lien</a>
          </section>
        </div>

        {/* Hero */}
        <section className="hero rise">
          <div className="hero__top">
            <div>
              <h1 className="hero__title">{courant ? `${courant.candidat.prenom} ${courant.candidat.nom}` : "Aucun entretien aujourd'hui"}</h1>
              <div className="hero__num"><span className="dot-num">{n ? sel + 1 : 0}</span><small>/{n}</small></div>
              {courant && (
                <div className="hero__sub">
                  <span>{quand(courant.date)} · {courant.poste}</span>
                  <span>Pré-vérification : {PREVERIF_STATUTS[courant.preVerification.statut]}</span>
                  <Statut e={courant} />
                </div>
              )}
              <div className="hero__arrows">
                <button className="rbtn" aria-label="Précédent" onClick={() => setSel((s) => (s - 1 + n) % n)}><I><IcArrowL /></I></button>
                <button className="rbtn" aria-label="Suivant" onClick={() => setSel((s) => (s + 1) % n)}><I><IcArrowR /></I></button>
              </div>
            </div>
            <div className="card device" data-depth="4">
              <div className="device__icons"><span className="device__ico"><IcWifi /></span><span className="device__ico"><IcCam /></span></div>
              <span className="device__art" aria-hidden><IcHeadset /></span>
              <div className="device__num"><span className="dot-num">{signaux}</span><small>signaux<br />à vérifier</small></div>
            </div>
          </div>

          <div className="hero__mid">
            <div className="timeline-h">
              <div className="timeline-h__line" />
              {aujourdhui.map((e, i) => (
                <button key={e.id} className={`tl-dot ${i < sel ? "tl-dot--done" : i === sel ? "tl-dot--now" : ""}`} style={{ left: `${6 + (i * 64) / Math.max(1, n - 1)}%` }} onClick={() => setSel(i)} aria-label={`${e.candidat.prenom} ${e.candidat.nom}`}>
                  <i /><span>{heure(e.date)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hero__bottom">
            <div className="hero__left">
              <div className="chips">
                <a className="chip" href="#/">Entretiens<i /></a>
                <a className="chip" href="#/rapports">Signaux<i /></a>
                <a className="chip" href="#/reglages">Défis<i /></a>
                <a className="chip" href="#/rapports">Rapports<i /></a>
              </div>
              <form className="ask" onSubmit={(e) => { e.preventDefault(); location.hash = "#/rapports"; }}>
                <I><IcSpark /></I>
                <input placeholder="Que voulez-vous vérifier ?" aria-label="Rechercher" />
                <button type="button" className="rbtn" aria-label="Dicter"><I s={16}><IcMic /></I></button>
                <button type="submit" className="rbtn" aria-label="Envoyer"><I s={16}><IcArrowR /></I></button>
              </form>
            </div>
            <div className="hero__right">
              {courant && (
                <div className="card feature" data-depth="3">
                  <span className="feature__ico rbtn"><span><IcPulse /></span></span>
                  <span className="feature__time"><IcClock /> 10 min</span>
                  <div className="feature__row">
                    <p className="feature__title">{courant.preVerification.signaux.length ? `Défi conseillé : ${DEFI_NOMS.main_devant_visage.toLowerCase()}` : "Proposer un défi pendant l'entretien"}</p>
                    <a className="rbtn rbtn--dark" href="/sidepanel.html" target="_blank" rel="noreferrer" aria-label="Ouvrir le panneau recruteur"><I s={16}><IcPlay /></I></a>
                  </div>
                </div>
              )}
              <div className="help">
                <a className="rbtn" href="#/reglages" aria-label="Assistance"><I><IcHeadset /></I></a>
                <a className="rbtn" href="#/reglages" aria-label="Aide"><I><IcHelp /></I></a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
