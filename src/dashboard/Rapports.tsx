import { useEffect, useState } from "react";
import type { Entretien } from "../shared/types";
import { getEntretiens } from "../shared/api";
import { DECISIONS } from "../shared/texts";
import { quand } from "../shared/format";
import { Statut } from "./Statut";

export function Rapports() {
  const [liste, setListe] = useState<Entretien[]>([]);
  useEffect(() => { getEntretiens().then((l) => setListe(l.filter((e) => e.statut === "termine"))); }, []);
  return (
    <>
      <header className="hero rise"><h1 className="hero__hi">Rapports</h1><div className="hero__center">{liste.length} entretiens terminés</div><div /></header>
      <div className="card rise">
        <table className="table">
          <thead><tr><th>Candidat</th><th>Quand</th><th>Fiabilité</th><th>Statut</th><th>Décision</th><th /></tr></thead>
          <tbody>
            {liste.map((e) => (
              <tr key={e.id}>
                <td>{e.candidat.prenom} {e.candidat.nom}</td>
                <td className="muted">{quand(e.date)}</td>
                <td>{e.score ? `${e.score.valeur} / 100` : "—"}</td>
                <td><Statut e={e} /></td>
                <td className="muted">{DECISIONS[e.decision]}</td>
                <td style={{ textAlign: "right" }}><a className="btn btn--secondary btn--sm" href={`#/rapport/${e.id}`}>Voir le rapport</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
