import type { CSSProperties, ReactNode } from "react";
import type { DefiType } from "../store/types";
import { actions, useEtat } from "../store/store";
import { DEFI_DESCRIPTIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { FaceScan, type ScanEtat } from "../ui/FaceScan";
import { Btn, Pill, Switch } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcCopy, IcHand, IcMic, IcRefresh, IcSpark } from "../ui/icons";
import "./pages.css";

const DEFIS: { type: DefiType; ic: ReactNode; vis: ScanEtat }[] = [
  { type: "main_devant_visage", ic: <IcHand />, vis: "geste" },
  { type: "rotation_tete", ic: <IcRefresh />, vis: "scan" },
  { type: "phrase_aleatoire", ic: <IcMic />, vis: "idle" },
];
const BIENTOT = [
  { nom: "Montrer un nombre de doigts", phrase: "Pouvez-vous montrer trois doigts devant la caméra ?", desc: "Un nombre tiré au hasard : la main doit apparaître nette devant le visage." },
  { nom: "Se rapprocher de la caméra", phrase: "Pouvez-vous vous rapprocher un instant de la caméra ?", desc: "Le changement de distance fait varier la netteté : un visage substitué décroche." },
];

/** Bibliothèque de défis : cartes activables, mise à jour comme les signatures d'un antivirus. */
export function Defis() {
  const etat = useEtat();
  const actifs = etat.reglages.defisActifs;
  const tous = etat.entretiens.flatMap((x) => x.defis);
  const basculer = (t: DefiType) => {
    const on = actifs.includes(t);
    if (on && actifs.length === 1) { toast("Gardez au moins un défi actif"); return; }
    actions.reglages({ defisActifs: on ? actifs.filter((y) => y !== t) : [...actifs, t] });
    toast(on ? `Défi désactivé : ${DEFI_NOMS[t].toLowerCase()}` : `Défi activé : ${DEFI_NOMS[t].toLowerCase()}`);
  };
  const copier = (t: string) => navigator.clipboard.writeText(t).then(() => toast("Phrase copiée"), () => toast("Copie impossible sur ce navigateur"));
  return (
    <div className="pages">
      <header className="panel page-head rise" style={{ "--i": 1 } as CSSProperties}>
        <div>
          <h1 className="t-display">Bibliothèque de défis</h1>
          <p className="muted">Manta propose les défis actifs pendant l'entretien, dans des phrases naturelles. La bibliothèque est mise à jour chaque mois, comme les signatures d'un antivirus.</p>
        </div>
        <Pill ton="soft-blue" dot>{actifs.length} actif{actifs.length > 1 ? "s" : ""} sur {DEFIS.length}</Pill>
      </header>
      <div className="defis-grid">
        {DEFIS.map(({ type, ic, vis }, i) => {
          const on = actifs.includes(type);
          const ds = tous.filter((d) => d.type === type);
          return (
            <article key={type} className={`panel defi-card rise${on ? "" : " is-off"}`} style={{ "--i": i + 2 } as CSSProperties}>
              <div className="defi-card__vis"><FaceScan etat={on ? vis : "off"} largeur={104} /><span className="defi-card__ic">{ic}</span></div>
              <div className="defi-card__titre"><h2 className="t-h2">{DEFI_NOMS[type]}</h2><Pill ton={on ? "soft-green" : "neutral"} dot>{on ? "Actif" : "Inactif"}</Pill></div>
              <p className="muted">{DEFI_DESCRIPTIONS[type]}</p>
              <q className="defi-card__phrase">{DEFI_PHRASES[type]}</q>
              <div className="defi-card__stats">
                <div className="inset"><b className="num">{ds.length}</b><span>proposés</span></div>
                <div className="inset"><b className="num">{ds.filter((d) => d.resultat === "reussi").length}</b><span>réussis</span></div>
                <div className="inset"><b className="num">{ds.filter((d) => d.resultat === "a_verifier").length}</b><span>à vérifier</span></div>
              </div>
              <div className="defi-card__pied">
                <label className="row" style={{ gap: 10 }}><Switch on={on} onChange={() => basculer(type)} label={`${on ? "Désactiver" : "Activer"} : ${DEFI_NOMS[type]}`} /><span className="t-small">{on ? "Proposé par Manta" : "Jamais proposé"}</span></label>
                <Btn size="sm" icon={<IcCopy />} onClick={() => copier(DEFI_PHRASES[type])}>Copier la phrase</Btn>
              </div>
            </article>
          );
        })}
        {BIENTOT.map((b, i) => (
          <article key={b.nom} className="panel defi-card is-bientot rise" style={{ "--i": i + 5 } as CSSProperties}>
            <div className="defi-card__vis"><FaceScan etat="off" largeur={104} /><span className="defi-card__ic"><IcSpark /></span></div>
            <div className="defi-card__titre"><h2 className="t-h2">{b.nom}</h2><Pill ton="soft-violet">Prochaine mise à jour</Pill></div>
            <p className="muted">{b.desc}</p>
            <q className="defi-card__phrase">{b.phrase}</q>
            <div className="defi-card__pied"><label className="row" style={{ gap: 10 }}><Switch on={false} onChange={() => undefined} label={`${b.nom} : bientôt disponible`} disabled /><span className="t-small">Bientôt disponible</span></label></div>
          </article>
        ))}
      </div>
    </div>
  );
}
