import { aujourdhui, nomComplet, parId, recruteur, useEtat } from "../store/store";
import { heure, jourCourt, jourLong, quand } from "../store/format";
import { DECISIONS, DEFI_NOMS } from "../store/texts";
import { etiquetteDefi, etiquetteEtape, etiquetteSignal, statutEntretien, statutPreVerif } from "../store/statuts";
import { Btn } from "../ui/ui";
import { IcArrowL, IcPrint } from "../ui/icons";
import { t } from "../i18n";
import "./rapport.css";

/** Vue du rapport prête à imprimer (ou à enregistrer en PDF depuis la fenêtre d'impression). */
export function RapportImprimer({ id }: { id: string }) {
  const etat = useEtat();
  const x = parId(etat, id);
  if (!x) return <div className="impr"><article className="impr__page"><p>{t("Entretien introuvable.")}</p><Btn href="#/">{t("Tableau de bord")}</Btn></article></div>;
  const ref = aujourdhui(etat);
  const p = x.preVerification;
  const signaux = [...x.signaux, ...p.signaux];
  return (
    <div className="impr">
      <div className="impr__barre no-print">
        <Btn icon={<IcArrowL />} href={`#/rapport/${x.id}`}>{t("Retour au rapport")}</Btn>
        <Btn variant="primary" icon={<IcPrint />} onClick={() => window.print()}>{t("Imprimer ou enregistrer en PDF")}</Btn>
      </div>
      <article className="impr__page">
        <header className="impr__tete">
          <span className="impr__logo"><span className="logo-o" />oval</span>
          <span>{t("Rapport d'entretien · édité le {date}", { date: jourLong(new Date()) })}</span>
        </header>
        <h1>{nomComplet(x)}</h1>
        <p className="impr__sous">{x.candidat.poste} · {jourCourt(x.date)}, {heure(x.date)} · {x.dureeMin} min · {t("mené par {nom}", { nom: recruteur(etat, x.recruteurId).nom })}</p>

        <section><h2>{t("Statut")}</h2><p><b>{statutEntretien(x, ref).texte}</b>{x.score ? ` · ${t("indice de fiabilité {n}/100 (consultatif)", { n: x.score.valeur })}` : ""}</p></section>
        <section><h2>{t("Ce que ça veut dire")}</h2>{(x.score?.resume ?? t("Pas encore de résumé : l'entretien n'a pas eu lieu.")).split("\n\n").map((t, i) => <p key={i}>{t}</p>)}</section>
        <section>
          <h2>{t("Déroulé")}</h2>
          {x.defis.length ? (
            <table><thead><tr><th>{t("Moment")}</th><th>{t("Défi")}</th><th>{t("Résultat")}</th><th>{t("Détail")}</th></tr></thead>
              <tbody>{x.defis.map((d) => <tr key={d.id}><td>min {d.debutMin ?? 0}–{d.finMin ?? (d.debutMin ?? 0) + 5}</td><td>{DEFI_NOMS[d.type]}</td><td>{etiquetteDefi(d.resultat).texte}</td><td>{d.detail ?? "—"}</td></tr>)}</tbody>
            </table>
          ) : <p>{t("Aucun défi mené.")}</p>}
        </section>
        <section>
          <h2>{t("Signaux relevés")}</h2>
          {signaux.length ? (
            <table><thead><tr><th>{t("Signal")}</th><th>{t("Résultat")}</th><th>{t("Explication")}</th></tr></thead>
              <tbody>{signaux.map((s) => <tr key={s.id}><td>{s.libelle}</td><td>{etiquetteSignal(s).texte}</td><td>{s.explication}</td></tr>)}</tbody>
            </table>
          ) : <p>{t("Aucun signal relevé. L'absence de signal ne compte ni pour ni contre.")}</p>}
        </section>
        <section>
          <h2>{t("Pré-vérification")}</h2>
          <p>{statutPreVerif(x, ref).texte}{p.faiteLe ? ` · ${t("faite {quand}", { quand: quand(p.faiteLe, ref).toLowerCase() })}` : ""}</p>
          <p>{t("Accord : {accord} · Caméra : {camera} · Lumière : {lumiere} · Geste : {geste}", { accord: etiquetteEtape(p.etapes.accord).texte, camera: etiquetteEtape(p.etapes.camera).texte, lumiere: etiquetteEtape(p.etapes.lumiere).texte, geste: etiquetteEtape(p.etapes.geste).texte })}</p>
        </section>
        <section>
          <h2>{t("Décision du recruteur")}</h2>
          <p><b>{DECISIONS[x.decision.valeur]}</b>{x.decision.le ? ` · ${recruteur(etat, x.decision.par ?? etat.moi).nom}, ${quand(x.decision.le, ref).toLowerCase()}` : ""}</p>
          {x.decision.note && <p>{t("Note : {note}", { note: x.decision.note })}</p>}
        </section>
        <footer className="impr__pied">{t("Oval vérifie une présence humaine, pas une identité. Aucune vidéo n'a été enregistrée. Ce rapport est une aide : la décision appartient au recruteur.")}</footer>
      </article>
    </div>
  );
}
