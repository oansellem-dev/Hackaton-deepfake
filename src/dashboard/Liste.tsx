import { useEffect, useState } from "react";
import type { Entretien } from "../shared/types";
import { getEntretiens } from "../shared/api";
import { RECRUTEUR } from "../shared/mock";
import { DEFI_NOMS, PREVERIF_STATUTS } from "../shared/texts";
import { quand } from "../shared/format";
import { Statut } from "./Statut";
import { useCountUp } from "./useCountUp";

const IcPhone = () => <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg></span>;
const IcBars = () => <span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4" height="9" rx="1" /><rect x="10" y="6" width="4" height="15" rx="1" /><rect x="17" y="9" width="4" height="12" rx="1" /></svg></span>;
const IcPlane = () => <svg className="plane" viewBox="0 0 64 64" fill="currentColor"><path d="M4 30 L60 6 L40 60 L32 36 Z" /><path d="M32 36 L60 6" stroke="#fff" strokeWidth="2" fill="none" /></svg>;
const IcSpark = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" /></svg>;
const IcPen = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
const IcBriefcase = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3V6a2 2 0 0 0-2-2zm0 2h6v1H9z" /></svg>;

export function Liste() {
  const [liste, setListe] = useState<Entretien[]>([]);
  useEffect(() => { getEntretiens().then(setListe); }, []);

  const aujourdhui = liste.filter((e) => e.statut !== "termine");
  const termines = liste.filter((e) => e.statut === "termine");
  const verifies = termines.filter((e) => e.score && e.score.signaux.length === 0).length;
  const preFaites = liste.filter((e) => e.preVerification.statut === "faite").length;
  const defis = liste.reduce((n, e) => n + e.defis.length, 0);
  const signaux = liste.reduce((n, e) => n + e.preVerification.signaux.length + (e.score?.signaux.length ?? 0), 0);
  const enAttente = aujourdhui.filter((e) => e.preVerification.statut === "envoyee").length;
  const nb = useCountUp(verifies);

  // Une seule carte inclinée : le premier entretien à venir avec un signal
  const attention = aujourdhui.find((e) => e.preVerification.signaux.length > 0)?.id;

  return (
    <>
      <header className="hero rise">
        <h1 className="hero__hi"><span className="avatar avatar--me">{RECRUTEUR.prenom[0]}</span>Bonjour, {RECRUTEUR.prenom} !</h1>
        <div className="hero__center">Entretiens du jour</div>
        <div className="hero__team">Équipe :
          <div className="avatars">
            {RECRUTEUR.equipe.map((i, k) => <span key={i} className={`avatar avatar--${"abcd"[k]}`}>{i}</span>)}
            <span className="avatar avatar--more">+3</span>
          </div>
        </div>
      </header>

      <div className="grid">
        {/* Colonne gauche */}
        <div className="col">
          <button className="select rise">
            <span className="select__icon" aria-hidden><IcBriefcase /></span>
            <span className="select__text"><strong>Développeur full-stack</strong><span>Tech · 4 entretiens cette semaine</span></span>
            <svg className="select__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>

          <div className="stat rise">
            <div className="big-number">{nb}</div>
            <div className="stat__label">présences humaines vérifiées cette semaine</div>
          </div>

          <div className="card card--yellow rise">
            <div className="card__head">
              <h2 className="card__title">Cette semaine</h2>
              <span className="pill pill--violet">Activité</span>
            </div>
            <div className="trio">
              <div><div className="trio__n">{preFaites}</div><div className="trio__l">pré-vérifications faites</div></div>
              <div><div className="trio__n">{defis}</div><div className="trio__l">défis proposés</div></div>
              <div><div className="trio__n">{signaux}</div><div className="trio__l">signaux à vérifier</div></div>
            </div>
            <a className="yellow__edit" href="#/rapports" aria-label="Voir le détail"><IcPen /></a>
          </div>
        </div>

        {/* Colonne centrale : les entretiens */}
        <div className="col">
          {aujourdhui.map((e) => {
            const estAttention = e.id === attention;
            const s0 = e.preVerification.signaux[0];
            return (
              <article key={e.id} className={`card card--hover entretien rise ${estAttention ? "entretien--attention" : ""}`}>
                <div className="card__head">
                  <h2 className="card__title">{estAttention ? <IcBars /> : <IcPhone />}{e.candidat.prenom} {e.candidat.nom}</h2>
                  <div className="entretien__tags">
                    <Statut e={e} />
                    {estAttention && <span className="pill pill--jaune">Entretien</span>}
                  </div>
                </div>
                <div className="card__rule" />
                {estAttention && s0 ? (
                  <div className="cols">
                    <div><div className="col__label">Signal</div><div className="col__value">{s0.libelle}</div></div>
                    <div><div className="col__label">Détail</div><div className="col__value" style={{ fontWeight: 400, fontSize: 14.5 }}>{s0.explication}</div></div>
                    <div><div className="col__label">Défi conseillé</div><div className="col__value">{DEFI_NOMS.main_devant_visage}</div></div>
                  </div>
                ) : (
                  <div className="cols">
                    <div><div className="col__label">Quand</div><div className="col__value">{quand(e.date)}</div></div>
                    <div><div className="col__label">Poste</div><div className="col__value">{e.poste.split(" · ")[0]}</div></div>
                    <div><div className="col__label">Pré-vérification</div><div className="col__value">{PREVERIF_STATUTS[e.preVerification.statut]}</div></div>
                  </div>
                )}
                <div className="entretien__foot">
                  <span className="entretien__who">
                    {estAttention ? (
                      <>Recruteurs : <span className="avatars"><span className="avatar avatar--a" style={{ width: 28, height: 28, fontSize: 11 }}>AL</span><span className="avatar avatar--c" style={{ width: 28, height: 28, fontSize: 11 }}>MR</span></span></>
                    ) : (
                      <><span className="avatars"><span className="avatar avatar--b" style={{ width: 28, height: 28, fontSize: 11 }}>SB</span><span className="avatar avatar--d" style={{ width: 28, height: 28, fontSize: 11 }}>NK</span></span>Prêt à rejoindre ?</>
                    )}
                  </span>
                  {estAttention
                    ? <a className="btn btn--primary" href={`#/rapport/${e.id}`}><IcSpark />Voir le rapport</a>
                    : <a className="btn btn--secondary" href="/sidepanel.html" target="_blank" rel="noreferrer">Rejoindre l'entretien</a>}
                </div>
                {estAttention && <IcPlane />}
              </article>
            );
          })}
        </div>

        {/* Colonne droite */}
        <div className="col">
          <div className="card rise">
            <div className="card__head">
              <h2 className="card__title"><span className="ic" style={{ color: "var(--orange)" }}><IcSpark /></span>Actions rapides</h2>
              <a className="btn btn--ghost btn--sm" href="#/pre-verifications">+ Nouveau</a>
            </div>
            <div className="actions">
              <a className="actions__item" href="#/pre-verifications">Envoyer un lien de pré-vérification<span className="actions__go" /></a>
              <a className="actions__item" href="#/rapports">Exporter le rapport de la semaine<span className="actions__go" /></a>
              <a className="actions__item" href="#/rapports">Voir les signaux à vérifier<span className="actions__go" /></a>
            </div>
          </div>

          <div className="card assist rise">
            <span className="pill pill--violet" style={{ marginBottom: 14 }}>Aujourd'hui</span>
            <div className="assist__row">
              <p className="assist__text">{aujourdhui.length} entretiens, {enAttente} pré-vérification{enAttente > 1 ? "s" : ""} en attente.</p>
              <div className="wave" aria-hidden>
                {Array.from({ length: 22 }).map((_, i) => <i key={i} style={{ "--h": `${30 + ((i * 37) % 60)}%`, animationDelay: `${(i % 7) * 0.12}s` } as React.CSSProperties} />)}
              </div>
            </div>
            <a className="assist__btn" href="#/pre-verifications" aria-label="Envoyer un lien"><IcSpark /></a>
          </div>
        </div>
      </div>
    </>
  );
}
