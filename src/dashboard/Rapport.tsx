import { useEffect, useState } from "react";
import type { Decision, Entretien } from "../shared/types";
import { enregistrerDecision, getEntretien } from "../shared/api";
import { DECISIONS, DEFI_NOMS, DEFI_RESULTATS, LUMIERE_RESULTATS, PREVERIF_STATUTS } from "../shared/texts";
import { heure, quand } from "../shared/format";
import { Statut } from "./Statut";

export function Rapport({ id }: { id: string }) {
  const [e, setE] = useState<Entretien | null | undefined>(undefined);
  useEffect(() => { getEntretien(id).then((x) => setE(x ?? null)); }, [id]);

  if (e === undefined) return <p className="muted">Chargement…</p>;
  if (e === null) return <div className="card rise"><p>Cet entretien n'existe pas. <a href="#/">Retour</a></p></div>;

  const decider = async (d: Decision) => { await enregistrerDecision(e.id, d); setE({ ...e, decision: d }); };
  const score = e.score;
  const signaux = score?.signaux ?? e.preVerification.signaux;
  const ok = signaux.length === 0;

  return (
    <>
      <header className="hero-h rise">
        <h1 className="hero-h__hi">Rapport d'entretien</h1>
        <div className="hero-h__center">{e.candidat.prenom} {e.candidat.nom}</div>
        <div className="hero-h__right"><Statut e={e} /></div>
      </header>

      <div className="rapport">
        <div className="col">
          <div className="card rise">
            <div className="card__head">
              <h2 className="card__title">Fiabilité</h2>
              <span className="pill pill--gris">consultatif</span>
            </div>
            {score ? (
              <>
                <div className="dot-num" style={{ fontSize: 96, marginTop: 10 }}>{score.valeur}<span style={{ fontSize: 28, color: "var(--ink-3)" }}> / 100</span></div>
                <div className="card__rule" />
                <ul className="explications">{score.explications.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>Pas encore de score : l'entretien n'a pas eu lieu. Ce n'est pas un signal.</p>
            )}
          </div>
        </div>

        <div className="col">
          <div className="card rise">
            <h2 className="card__title">Entretien</h2>
            <div className="card__rule" />
            <div className="cols">
              <div><div className="col__label">Quand</div><div className="col__value">{quand(e.date)}</div></div>
              <div><div className="col__label">Poste</div><div className="col__value">{e.poste}</div></div>
              <div><div className="col__label">Lieu déclaré</div><div className="col__value">{e.candidat.villeDeclaree ?? "—"}</div></div>
            </div>
          </div>

          <div className="card rise">
            <div className="card__head">
              <h2 className="card__title">Pré-vérification</h2>
              <span className="pill pill--gris">{PREVERIF_STATUTS[e.preVerification.statut]}</span>
            </div>
            <div className="card__rule" />
            {e.preVerification.statut !== "faite" ? (
              <p className="muted">Pas d'information à ce stade. L'absence de pré-vérification n'est jamais un signal négatif.</p>
            ) : (
              <>
                <div className="cols">
                  <div><div className="col__label">Signaux techniques</div><div className="col__value">{e.preVerification.signaux.length === 0 ? "Rien à signaler" : `${e.preVerification.signaux.length} à vérifier`}</div></div>
                  <div><div className="col__label">Test de lumière</div><div className="col__value">{e.preVerification.testLumiere ? LUMIERE_RESULTATS[e.preVerification.testLumiere] : "—"}</div></div>
                  <div><div className="col__label">Vidéo conservée</div><div className="col__value">Aucune</div></div>
                </div>
              </>
            )}
          </div>

          <div className="card rise">
            <h2 className="card__title">Défis proposés</h2>
            <div className="card__rule" />
            {e.defis.length === 0 ? <p className="muted">Aucun défi proposé pour l'instant.</p> : (
              <ul className="timeline">
                {e.defis.map((d) => (
                  <li key={d.id}>
                    <time>{d.horodatage ? heure(d.horodatage) : "—"}</time>
                    <span>{DEFI_NOMS[d.type]} — <span className="muted">« {d.phrase} »</span></span>
                    <span className={`pill ${d.resultat === "execute" ? "pill--vert" : d.resultat === "signal_a_verifier" ? "pill--rouge" : "pill--gris"}`}>{DEFI_RESULTATS[d.resultat]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {signaux.length > 0 && (
            <div className="card rise">
              <h2 className="card__title">Signaux à vérifier</h2>
              <div className="card__rule" />
              <ul className="signaux" style={{ gap: 14 }}>
                {signaux.map((s) => (
                  <li key={s.id}>
                    <span className={`pill ${s.niveau === "fort" ? "pill--rouge" : "pill--gris"}`}>{s.niveau === "fort" ? "Fort" : "Moyen"}</span>
                    <span><strong style={{ fontWeight: 500 }}>{s.libelle}</strong><br /><span className="muted small">{s.explication}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card rise">
            <div className="card__head">
              <h2 className="card__title">Décision du recruteur</h2>
              <span className="pill pill--gris">{DECISIONS[e.decision]}</span>
            </div>
            <div className="card__rule" />
            <p className="muted">Le score est une aide. La décision vous appartient et reste tracée ici.</p>
            <div className="decision-row">
              <button className={`btn ${e.decision === "poursuivre" ? "btn--primary" : "btn--secondary"}`} onClick={() => decider("poursuivre")}>Poursuivre le processus</button>
              <button className={`btn ${e.decision === "revoir" ? "btn--primary" : "btn--secondary"}`} onClick={() => decider("revoir")}>Revoir avec le candidat</button>
              <button className="btn btn--ghost" onClick={() => window.print()}>Exporter</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
