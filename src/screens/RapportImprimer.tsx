import { aujourdhui, nomComplet, parId, recruteur, useEtat } from "../store/store";
import { heure, jourCourt, jourLong, quand } from "../store/format";
import { DECISIONS, DEFI_NOMS } from "../store/texts";
import { etiquetteDefi, etiquetteEtape, etiquetteSignal, statutEntretien, statutPreVerif } from "../store/statuts";
import { Btn } from "../ui/ui";
import { IcArrowL, IcPrint } from "../ui/icons";
import "./rapport.css";

/** Vue du rapport prête à imprimer (ou à enregistrer en PDF depuis la fenêtre d'impression). */
export function RapportImprimer({ id }: { id: string }) {
  const etat = useEtat();
  const x = parId(etat, id);
  if (!x) return <div className="impr"><article className="impr__page"><p>Entretien introuvable.</p><Btn href="#/">Tableau de bord</Btn></article></div>;
  const ref = aujourdhui(etat);
  const p = x.preVerification;
  const signaux = [...x.signaux, ...p.signaux];
  return (
    <div className="impr">
      <div className="impr__barre no-print">
        <Btn icon={<IcArrowL />} href={`#/rapport/${x.id}`}>Retour au rapport</Btn>
        <Btn variant="primary" icon={<IcPrint />} onClick={() => window.print()}>Imprimer ou enregistrer en PDF</Btn>
      </div>
      <article className="impr__page">
        <header className="impr__tete">
          <span className="impr__logo"><span className="logo-o" />oval</span>
          <span>Rapport d'entretien · édité le {jourLong(new Date())}</span>
        </header>
        <h1>{nomComplet(x)}</h1>
        <p className="impr__sous">{x.candidat.poste} · {jourCourt(x.date)}, {heure(x.date)} · {x.dureeMin} min · mené par {recruteur(etat, x.recruteurId).nom}</p>

        <section><h2>Statut</h2><p><b>{statutEntretien(x, ref).texte}</b>{x.score ? ` · indice de fiabilité ${x.score.valeur}/100 (consultatif)` : ""}</p></section>
        <section><h2>Ce que ça veut dire</h2>{(x.score?.resume ?? "Pas encore de résumé : l'entretien n'a pas eu lieu.").split("\n\n").map((t, i) => <p key={i}>{t}</p>)}</section>
        <section>
          <h2>Déroulé</h2>
          {x.defis.length ? (
            <table><thead><tr><th>Moment</th><th>Défi</th><th>Résultat</th><th>Détail</th></tr></thead>
              <tbody>{x.defis.map((d) => <tr key={d.id}><td>min {d.debutMin ?? 0}–{d.finMin ?? (d.debutMin ?? 0) + 5}</td><td>{DEFI_NOMS[d.type]}</td><td>{etiquetteDefi(d.resultat).texte}</td><td>{d.detail ?? "—"}</td></tr>)}</tbody>
            </table>
          ) : <p>Aucun défi mené.</p>}
        </section>
        <section>
          <h2>Signaux relevés</h2>
          {signaux.length ? (
            <table><thead><tr><th>Signal</th><th>Résultat</th><th>Explication</th></tr></thead>
              <tbody>{signaux.map((s) => <tr key={s.id}><td>{s.libelle}</td><td>{etiquetteSignal(s).texte}</td><td>{s.explication}</td></tr>)}</tbody>
            </table>
          ) : <p>Aucun signal relevé. L'absence de signal ne compte ni pour ni contre.</p>}
        </section>
        <section>
          <h2>Pré-vérification</h2>
          <p>{statutPreVerif(x, ref).texte}{p.faiteLe ? ` · faite ${quand(p.faiteLe, ref).toLowerCase()}` : ""}</p>
          <p>Accord : {etiquetteEtape(p.etapes.accord).texte} · Caméra : {etiquetteEtape(p.etapes.camera).texte} · Lumière : {etiquetteEtape(p.etapes.lumiere).texte} · Geste : {etiquetteEtape(p.etapes.geste).texte}</p>
        </section>
        <section>
          <h2>Décision du recruteur</h2>
          <p><b>{DECISIONS[x.decision.valeur]}</b>{x.decision.le ? ` · ${recruteur(etat, x.decision.par ?? etat.moi).nom}, ${quand(x.decision.le, ref).toLowerCase()}` : ""}</p>
          {x.decision.note && <p>Note : {x.decision.note}</p>}
        </section>
        <footer className="impr__pied">Oval vérifie une présence humaine, pas une identité. Aucune vidéo n'a été enregistrée. Ce rapport est une aide : la décision appartient au recruteur.</footer>
      </article>
    </div>
  );
}
