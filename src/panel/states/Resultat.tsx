import type { Score } from "../../shared/types";

export function Resultat({ score, onNouveauDefi, onTerminer }: { score: Score; onNouveauDefi: () => void; onTerminer: () => void }) {
  const ok = score.signaux.length === 0;
  return (
    <>
      <div className="card rise">
        <div className="card__head">
          <div className="score">
            <span className="score__value">{score.valeur}</span>
            <span className="score__label">/ 100<br />fiabilité</span>
          </div>
          <span className={`pill ${ok ? "pill--vert" : "pill--rouge"}`}>{ok ? "Présence vérifiée" : "Signal à vérifier"}</span>
        </div>
        <div className="card__rule" />
        <ul className="explications">
          {score.explications.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>

      {score.signaux.length > 0 && (
        <div className="card rise">
          <h2 className="card__title">Signaux relevés</h2>
          <div className="card__rule" />
          <ul className="signaux">
            {score.signaux.map((s) => (
              <li key={s.id}>
                <span className={`pill ${s.niveau === "fort" ? "pill--rouge" : "pill--gris"}`}>{s.niveau === "fort" ? "Fort" : "Moyen"}</span>
                <span>{s.libelle}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="small muted">Le score est une aide. Vous décidez.</p>
      <div className="panel__actions">
        <button className="btn btn--secondary" onClick={onNouveauDefi}>Nouveau défi</button>
        <button className="btn btn--primary" onClick={onTerminer}>Terminer l'entretien</button>
      </div>
    </>
  );
}
