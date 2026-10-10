import type { Defi } from "../../shared/types";
import { DEFI_NOMS } from "../../shared/texts";

export function DefiEnCours({ defi, analyse, onAutre, onVerifier }: { defi: Defi; analyse: boolean; onAutre: () => void; onVerifier: () => void }) {
  return (
    <>
      <div className="card">
        <div className="card__head">
          <span className="pill pill--bleu">{DEFI_NOMS[defi.type]}</span>
          {analyse && <span className="pill pill--gris">Analyse en cours</span>}
        </div>
        <div className="card__rule" />
        <p className="panel__quote">« {defi.phrase} »</p>
      </div>
      <div className="panel__actions">
        <button className="btn btn--secondary" onClick={onAutre} disabled={analyse}>Autre défi</button>
        <button className="btn btn--primary" onClick={onVerifier} disabled={analyse}>
          {analyse ? "Je vérifie…" : "Le geste est fait"}
        </button>
      </div>
    </>
  );
}
