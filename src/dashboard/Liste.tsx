import { useEffect, useState } from "react";
import type { Entretien } from "../shared/types";
import { getEntretiens } from "../shared/api";
import { RECRUTEUR } from "../shared/mock";
import { DEFI_NOMS, PREVERIF_STATUTS } from "../shared/texts";
import { quand } from "../shared/format";
import { Manta } from "../manta/Manta";
import { Statut } from "./Statut";

const IcPhone = () => <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg></span>;
const IcSignal = () => <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg></span>;

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

  // Une seule carte inclinée : le premier entretien à venir avec un signal
  const attention = aujourdhui.find((e) => e.preVerification.signaux.length > 0)?.id;

  return (
    <>
      <header className="hero">
        <h1 className="hero__hi"><span className="avatar avatar--photo" style={{ width: 56, height: 56, fontSize: 18 }}>{RECRUTEUR.prenom[0]}</span>Bonjour, {RECRUTEUR.prenom} !</h1>
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
          <button className="select">
            <span className="select__icon" aria-hidden>⌘</span>
            <span className="select__text"><strong>Développeur full-stack</strong><span>Tech · 4 entretiens cette semaine</span></span>
            <span className="select__chevron">⌄</span>
          </button>

          <div className="stat">
            <div className="big-number">{verifies}</div>
            <div className="stat__label">présences humaines vérifiées cette semaine</div>
          </div>

          <div className="card card--color">
            <div className="card__head">
              <h2 className="card__title">Cette semaine</h2>
              <span className="pill pill--bleu">Activité</span>
            </div>
            <div className="trio">
              <div><div className="trio__n">{preFaites}</div><div className="trio__l">pré-vérifications faites</div></div>
              <div><div className="trio__n">{defis}</div><div className="trio__l">défis proposés</div></div>
              <div><div className="trio__n">{signaux}</div><div className="trio__l">signaux à vérifier</div></div>
            </div>
          </div>
        </div>

        {/* Colonne centrale : les entretiens */}
        <div className="col">
          {aujourdhui.map((e) => {
            const estAttention = e.id === attention;
            const s0 = e.preVerification.signaux[0];
            return (
              <article key={e.id} className={`card entretien ${estAttention ? "entretien--attention" : ""}`}>
                <div className="card__head">
                  <h2 className="card__title">{estAttention ? <IcSignal /> : <IcPhone />}{e.candidat.prenom} {e.candidat.nom}</h2>
                  <Statut e={e} />
                </div>
                <div className="card__rule" />
                {estAttention && s0 ? (
                  <div className="cols">
                    <div><div className="col__label">Signal</div><div className="col__value">{s0.libelle}</div></div>
                    <div><div className="col__label">Détail</div><div className="col__value small" style={{ fontWeight: 400 }}>{s0.explication}</div></div>
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
                  <span className="entretien__who">{estAttention ? `${quand(e.date)} · ${e.poste.split(" · ")[0]}` : "Prêt à rejoindre ?"}</span>
                  {estAttention
                    ? <a className="btn btn--primary" href={`#/rapport/${e.id}`}>Voir le rapport</a>
                    : <a className="btn btn--secondary" href="/sidepanel.html" target="_blank" rel="noreferrer">Rejoindre l'entretien</a>}
                </div>
              </article>
            );
          })}
        </div>

        {/* Colonne droite */}
        <div className="col">
          <div className="card">
            <div className="card__head">
              <h2 className="card__title">Actions rapides</h2>
              <a className="btn btn--ghost btn--sm" href="#/pre-verifications">+ Nouveau</a>
            </div>
            <div className="actions">
              <a className="actions__item" href="#/pre-verifications">Envoyer un lien de pré-vérification<span className="actions__go">→</span></a>
              <a className="actions__item" href="#/rapports">Exporter le rapport de la semaine<span className="actions__go">→</span></a>
              <a className="actions__item" href="#/rapports">Voir les signaux à vérifier<span className="actions__go">→</span></a>
            </div>
          </div>

          <div className="card mantacard">
            <Manta state="neutre" size={96} />
            <div>
              <span className="pill pill--bleu" style={{ marginBottom: 10 }}>Manta</span>
              <p className="mantacard__text">
                {aujourdhui.length} entretien{aujourdhui.length > 1 ? "s" : ""} aujourd'hui, {enAttente} pré-vérification{enAttente > 1 ? "s" : ""} en attente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
