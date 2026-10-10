import type { Entretien } from "../../shared/types";
import { PREVERIF_STATUTS } from "../../shared/texts";
import { heure } from "../../shared/format";

export function Attente({ entretien, onProposer }: { entretien: Entretien; onProposer: () => void }) {
  const pv = entretien.preVerification;
  const n = pv.signaux.length;
  const resume =
    pv.statut !== "faite" ? "Pas encore d'information : ce n'est pas un signal." : n === 0 ? "Rien à signaler" : `${n} point${n > 1 ? "s" : ""} à vérifier`;
  const pillClass = pv.statut !== "faite" ? "pill--gris" : n === 0 ? "pill--vert" : "pill--orange";

  return (
    <>
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Entretien détecté</h2>
          <span className="pill pill--bleu">{heure(entretien.date)}</span>
        </div>
        <div className="card__rule" />
        <div className="cols">
          <div><div className="col__label">Poste</div><div className="col__value">{entretien.poste.split(" · ")[0]}</div></div>
          <div><div className="col__label">Pré-vérification</div><div className="col__value">{PREVERIF_STATUTS[pv.statut]}</div></div>
          <div><div className="col__label">Test de lumière</div><div className="col__value">{pv.testLumiere ? ({ coherent: "Cohérent", incoherent: "À vérifier", non_concluant: "Non concluant", passe: "Étape passée" })[pv.testLumiere] : "—"}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Avant l'entretien</h2>
          <span className={`pill ${pillClass}`}>{resume}</span>
        </div>
        {n > 0 && (
          <>
            <div className="card__rule" />
            <ul className="signaux">
              {pv.signaux.map((s) => (
                <li key={s.id}><span className="pill pill--orange">À vérifier</span><span>{s.libelle}</span></li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="panel__actions">
        <button className="btn btn--primary" onClick={onProposer}>Proposer un défi</button>
      </div>
    </>
  );
}
