import type { Decision, Entretien, Score } from "../../shared/types";
import { DECISIONS } from "../../shared/texts";

export function Fin({ entretien, score, onDecider }: { entretien: Entretien; score: Score | null; onDecider: (d: Decision) => void }) {
  const prise = entretien.decision !== "non_prise";
  const lienRapport = `${location.origin}/index.html#/rapport/${entretien.id}`;
  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Votre décision</h2>
          {score && <span className="pill pill--gris">{score.valeur} / 100</span>}
        </div>
        <div className="card__rule" />
        {prise ? (
          <p className="decision__done">Décision enregistrée : <strong>{DECISIONS[entretien.decision]}</strong>. Elle figure dans le rapport.</p>
        ) : (
          <div className="decision">
            <button className="btn btn--primary" onClick={() => onDecider("poursuivre")}>Poursuivre le processus</button>
            <button className="btn btn--secondary" onClick={() => onDecider("revoir")}>Revoir avec le candidat</button>
          </div>
        )}
      </div>
      <a className="btn btn--ghost" href={lienRapport} target="_blank" rel="noreferrer">Voir le rapport d'entretien →</a>
    </>
  );
}
