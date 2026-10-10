import { useEffect, useMemo, useState } from "react";
import type { Entretien } from "../shared/types";
import { getEntretiens } from "../shared/api";
import { DEFI_NOMS, PREVERIF_STATUTS } from "../shared/texts";
import { heure, quand } from "../shared/format";
import { Statut } from "./Statut";
import { useCountUp } from "./useCountUp";
import { IcArrowL, IcArrowR, IcCam, IcCheck, IcChevron, IcClock, IcHeadset, IcHelp, IcMic, IcPlay, IcPlus, IcPulse, IcSpark, IcWifi, IcArrowR as IcGo } from "./icons";

/* ---------- Courbe de progression (SVG) ---------- */
function Courbe({ serie, serie2, serie3 }: { serie: number[]; serie2: number[]; serie3: number[] }) {
  const W = 300, H = 230, pad = 10;
  const max = 40;
  const x = (i: number, n: number) => pad + (i * (W - 2 * pad)) / (n - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const path = (s: number[]) => {
    const pts = s.map((v, i) => [x(i, s.length), y(v)] as const);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    return d;
  };
  const last = serie.length - 1;
  const lx = x(last, serie.length), ly = y(serie[last]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fbe98a" stopOpacity=".95" /><stop offset="1" stopColor="#fbe98a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 20, 40].map((v) => <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="rgba(0,0,0,.12)" strokeDasharray="2 4" />)}
      {["Juin", "Sept.", "Déc."].map((m, i) => <text key={m} x={x(i * 4, 9)} y={14} fontSize="10" fill="#9a9a9a" fontFamily="Lexend">{m}</text>)}
      {[0, 20, 40].map((v) => <text key={v} x={W - pad + 4} y={y(v) + 3} fontSize="9" fill="#9a9a9a" fontFamily="Lexend">{v}</text>)}
      <path className="chart__glow" d={`M${lx} ${ly} L${W + 30} ${ly - 70} L${W + 30} ${ly + 70} Z`} />
      <path d={path(serie3)} fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="1.2" />
      <path d={path(serie2)} fill="none" stroke="rgba(0,0,0,.3)" strokeWidth="1.2" />
      <path d={path(serie)} fill="none" stroke="#1b1b1b" strokeWidth="1.8" strokeLinecap="round" style={{ strokeDasharray: 900, strokeDashoffset: 900, animation: "draw 1.6s cubic-bezier(.2,.7,.2,1) .3s forwards" }} />
      <circle cx={lx} cy={ly} r="11" fill="#fff" stroke="rgba(0,0,0,.08)" />
      <circle cx={lx} cy={ly} r="3" fill="#1b1b1b" />
      <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

/* ---------- Jauge semi-circulaire ---------- */
function Jauge({ valeur }: { valeur: number }) {
  const W = 320, H = 190, cx = 160, cy = 170, r = 130;
  const a = (p: number) => Math.PI + (p / 100) * Math.PI; // 0 → gauche, 100 → droite
  const pt = (p: number, rr = r) => [cx + rr * Math.cos(a(p)), cy + rr * Math.sin(a(p))] as const;
  const arc = (p0: number, p1: number, rr = r) => {
    const [x0, y0] = pt(p0, rr), [x1, y1] = pt(p1, rr);
    return `M${x0} ${y0} A${rr} ${rr} 0 ${p1 - p0 > 50 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const wedge = (p0: number, p1: number) => {
    const [x0, y0] = pt(p0, r + 6), [x1, y1] = pt(p1, r + 6);
    return `M${cx} ${cy} L${x0} ${y0} A${r + 6} ${r + 6} 0 0 1 ${x1} ${y1} Z`;
  };
  const [nx, ny] = pt(valeur, r + 8);
  const [tx, ty] = pt(valeur, r + 34);
  const labels: [string, number][] = [["À vérifier", 12], ["Non concluant", 37], ["Cohérent", 63], ["Vérifiée", 88]];
  return (
    <div className="gauge">
      <svg viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <defs>
          <radialGradient id="wedge" cx="50%" cy="100%" r="80%"><stop offset="0" stopColor="#fbe98a" stopOpacity=".95" /><stop offset="1" stopColor="#fbe98a" stopOpacity="0" /></radialGradient>
        </defs>
        <path d={wedge(Math.max(0, valeur - 18), Math.min(100, valeur + 6))} fill="url(#wedge)" />
        <path d={arc(0, 100)} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeDasharray="1.5 5" />
        <path d={arc(0, 100, r - 14)} fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="1" strokeDasharray="1 4" />
        {labels.map(([l, p]) => { const [x, y] = pt(p, r + 24); const rot = (p / 100) * 180 - 90; return <text key={l} className="gauge__label" x={x} y={y} textAnchor="middle" transform={`rotate(${rot} ${x} ${y})`}>{l}</text>; })}
        <line x1={nx} y1={ny} x2={tx} y2={ty} stroke="#1b1b1b" strokeWidth="1.5" />
        <circle cx={nx} cy={ny} r="12" fill="#fff" stroke="rgba(0,0,0,.08)" />
        <circle cx={nx} cy={ny} r="3" fill="#1b1b1b" />
      </svg>
      <div className="gauge__num"><span className="dot-num">{valeur}</span><small>/100</small></div>
    </div>
  );
}

export function Liste() {
  const [liste, setListe] = useState<Entretien[]>([]);
  const [sel, setSel] = useState(0);
  const [onglet, setOnglet] = useState<"total" | "verifiees" | "signaux">("verifiees");
  useEffect(() => { getEntretiens().then(setListe); }, []);

  const aujourdhui = useMemo(() => liste.filter((e) => e.statut !== "termine"), [liste]);
  const termines = liste.filter((e) => e.statut === "termine");
  const verifies = termines.filter((e) => e.score && e.score.signaux.length === 0).length;
  const signaux = liste.reduce((n, e) => n + e.preVerification.signaux.length + (e.score?.signaux.length ?? 0), 0);
  const nbVerif = useCountUp(verifies * 15 + 1); // chiffre de la semaine (démo)
  const courant = aujourdhui[sel] ?? aujourdhui[0];
  const dernier = termines[0];
  const scoreRef = dernier?.score?.valeur ?? 0;

  const series = {
    verifiees: [2, 9, 14, 11, 19, 16, 24, 22, 31],
    total: [4, 12, 16, 15, 22, 21, 28, 27, 35],
    signaux: [1, 2, 3, 2, 4, 3, 4, 3, 4],
  };

  return (
    <div className="dgrid">
      {/* Progression */}
      <section className="card progress-card rise">
        <div className="card__head">
          <h2 className="card__title">Progression</h2>
          <span className="card__meta">Période <b>2026</b> <IcChevron /></span>
        </div>
        <div className="chart">
          <Courbe serie={series[onglet]} serie2={series.total.map((v) => v * 0.6)} serie3={series.signaux.map((v) => v * 3)} />
          <div className="chart__num" style={{ right: 6, top: "48%" }}>
            <span className="dot-num">{nbVerif}</span>
            <span>+103 % sur l'année</span>
          </div>
        </div>
        <div className="chart__tabs" role="tablist">
          <button aria-pressed={onglet === "total"} onClick={() => setOnglet("total")}>Total</button>
          <button aria-pressed={onglet === "verifiees"} onClick={() => setOnglet("verifiees")}>Vérifiées</button>
          <button aria-pressed={onglet === "signaux"} onClick={() => setOnglet("signaux")}>Signaux</button>
        </div>
      </section>

      {/* Score du dernier entretien */}
      <section className="card score-card rise">
        <div className="card__head">
          <h2 className="card__title">Fiabilité</h2>
          <a className="rbtn rbtn--dark" href={dernier ? `#/rapport/${dernier.id}` : "#/rapports"} style={{ width: 26, height: 26 }} aria-label="Voir le rapport"><span style={{ width: 12, height: 12, display: "inline-flex" }}><IcPlus /></span></a>
        </div>
        <Jauge valeur={scoreRef} />
        <p className="small muted" style={{ textAlign: "center", marginTop: 8 }}>{dernier ? `${dernier.candidat.prenom} ${dernier.candidat.nom} · consultatif` : "—"}</p>
      </section>

      {/* Planning */}
      <section className="card sched-card rise">
        <div className="card__head">
          <h2 className="card__title">Planning</h2>
          <span className="card__meta">Poste <b>Full-stack</b> <IcChevron /></span>
        </div>
        <div className="week"><b>Semaine 1</b><span className="week__line" /><span>6 – 10 oct.</span></div>
        <div className="days">
          {[0, 1, 2, 3].map((i) => <span key={i} className="day day--done" title="Entretien fait"><i><IcCheck /></i></span>)}
          <span className="day day--now" title="Aujourd'hui"><span style={{ width: 16, height: 16, display: "inline-flex", color: "#1b1b1b" }}><IcPlus /></span></span>
        </div>
        <div className="week"><span>Semaine 2</span><span className="week__line" /><span>13 – 17 oct.</span></div>
        <div className="days">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="day day--todo" />)}</div>
      </section>

      {/* Carte média : prochaine pré-vérification */}
      <section className="card media media-card rise">
        <span className="media__time"><IcClock /> 2 min</span>
        <p className="media__title">Pré-vérification, test de lumière et défi gestuel</p>
        <a className="btn btn--primary btn--sm" href="#/pre-verifications">Envoyer un lien</a>
      </section>

      {/* Hero */}
      <section className="hero rise">
        <div className="hero__blob" aria-hidden /><div className="hero__dots" aria-hidden />
        <div>
          <h1 className="hero__title">{courant ? `${courant.candidat.prenom} ${courant.candidat.nom}` : "Aucun entretien"}</h1>
          <div className="hero__num"><span className="dot-num">{aujourdhui.length ? sel + 1 : 0}</span><small>/{aujourdhui.length}</small></div>
          {courant && (
            <div className="hero__sub">
              {quand(courant.date)} · {courant.poste} · Pré-vérification : {PREVERIF_STATUTS[courant.preVerification.statut]}
              {" "}<Statut e={courant} />
            </div>
          )}
          <div className="hero__arrows">
            <button className="rbtn" aria-label="Précédent" onClick={() => setSel((s) => (s - 1 + aujourdhui.length) % aujourdhui.length)}><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcArrowL /></span></button>
            <button className="rbtn" aria-label="Suivant" onClick={() => setSel((s) => (s + 1) % aujourdhui.length)}><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcArrowR /></span></button>
          </div>
        </div>

        <div className="card device rise">
          <div className="device__icons"><span className="device__ico"><IcWifi /></span><span className="device__ico"><IcCam /></span></div>
          <span className="device__art" aria-hidden><span style={{ width: 54, height: 54, display: "inline-flex" }}><IcHeadset /></span></span>
          <div className="device__num"><span className="dot-num">{signaux}</span><small>signaux<br />à vérifier</small></div>
        </div>

        <div className="timeline-h">
          <div className="timeline-h__line" />
          {aujourdhui.map((e, i) => (
            <button key={e.id} className={`tl-dot ${i < sel ? "tl-dot--done" : i === sel ? "tl-dot--now" : ""}`} style={{ left: `${8 + (i * 70) / Math.max(1, aujourdhui.length - 1)}%`, background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setSel(i)} aria-label={`${e.candidat.prenom} ${e.candidat.nom}`}>
              <i /><span>{heure(e.date)}</span>
            </button>
          ))}
        </div>

        {courant && (
          <div className="card feature">
            <span className="feature__ico rbtn" style={{ width: 40, height: 40 }}><span style={{ width: 16, height: 16, display: "inline-flex" }}><IcPulse /></span></span>
            <span className="feature__time"><IcClock /> 10 min</span>
            <p className="feature__title">{courant.preVerification.signaux.length ? `Défi conseillé : ${DEFI_NOMS.main_devant_visage}` : "Proposer un défi pendant l'entretien"}</p>
            <a className="rbtn rbtn--dark" href="/sidepanel.html" target="_blank" rel="noreferrer" aria-label="Ouvrir le panneau recruteur"><span style={{ width: 16, height: 16, display: "inline-flex" }}><IcPlay /></span></a>
          </div>
        )}

        <div className="hero__bottom">
          <div className="chips">
            <a className="chip" href="#/">Entretiens<i /></a>
            <a className="chip" href="#/rapports">Signaux<i /></a>
            <a className="chip" href="#/reglages">Défis<i /></a>
            <a className="chip" href="#/rapports">Rapports<i /></a>
          </div>
          <form className="ask" onSubmit={(e) => { e.preventDefault(); location.hash = "#/rapports"; }}>
            <span style={{ width: 18, height: 18, display: "inline-flex" }}><IcSpark /></span>
            <input placeholder="Que voulez-vous vérifier ?" aria-label="Rechercher" />
            <button type="button" className="rbtn" aria-label="Dicter"><span style={{ width: 16, height: 16, display: "inline-flex" }}><IcMic /></span></button>
            <button type="submit" className="rbtn" aria-label="Envoyer"><span style={{ width: 16, height: 16, display: "inline-flex" }}><IcGo /></span></button>
          </form>
        </div>
        <div className="hero__help">
          <a className="rbtn" href="#/reglages" aria-label="Assistance"><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcHeadset /></span></a>
          <a className="rbtn" href="#/reglages" aria-label="Aide"><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcHelp /></span></a>
        </div>
      </section>
    </div>
  );
}
