import type { CSSProperties, ReactNode } from "react";
import type { DefiType } from "../store/types";
import { actions, useEtat } from "../store/store";
import { DEFI_DESCRIPTIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { Manta } from "../manta/Manta";
import { Btn, Pill, Switch } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcCopy, IcHand, IcMic, IcRefresh, IcSpark } from "../ui/icons";
import "./pages.css";

const DEFIS: { type: DefiType; ic: ReactNode; pourquoi: string }[] = [
  { type: "main_devant_visage", ic: <IcHand />, pourquoi: "Un visage substitué en direct se déchire quand une main passe devant." },
  { type: "rotation_tete", ic: <IcRefresh />, pourquoi: "De profil, un masque numérique perd ses repères et se déforme." },
  { type: "phrase_aleatoire", ic: <IcMic />, pourquoi: "Une phrase imprévisible : les lèvres et le son doivent rester alignés." },
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
      <header className="page-head rise" style={{ "--i": 1 } as CSSProperties}>
        <div><h1 className="t-display">Défis</h1><p className="muted">Pendant la visio, Manta demande au candidat un geste simple. Un visage substitué en direct ne le suit pas. Activez ceux que vous voulez proposer.</p></div>
        <Pill ton="soft-blue" dot>{actifs.length} actif{actifs.length > 1 ? "s" : ""} sur {DEFIS.length}</Pill>
      </header>
      <ol className="panel comment rise" style={{ "--i": 2 } as CSSProperties}>
        <li><b>1</b><span><strong>Manta propose</strong>un défi dans le panneau, en pleine visio.</span></li>
        <li><b>2</b><span><strong>Vous le demandez</strong>au candidat, avec la phrase prête à lire.</span></li>
        <li><b>3</b><span><strong>Oval observe</strong>le geste et note « réussi » ou « à vérifier ».</span></li>
        <li><b>4</b><span><strong>Vous décidez</strong>après l'entretien, dans le rapport.</span></li>
      </ol>
      <div className="defis-grid">
        {DEFIS.map(({ type, ic, pourquoi }, i) => {
          const on = actifs.includes(type);
          const ds = tous.filter((d) => d.type === type);
          return (
            <article key={type} className={`panel defi-card rise${on ? "" : " is-off"}`} style={{ "--i": i + 2 } as CSSProperties}>
              <div className="defi-card__titre"><span className="defi-card__ic">{ic}</span><h2 className="t-h3">{DEFI_NOMS[type]}</h2><Pill ton={on ? "soft-green" : "neutral"} dot>{on ? "Actif" : "Inactif"}</Pill></div>
              <div className="defi-card__dit"><Manta size={48} state={on ? "defi" : "neutre"} /><q>{DEFI_PHRASES[type]}</q></div>
              <dl className="defi-card__kv"><dt>Ce qu'on regarde</dt><dd>{DEFI_DESCRIPTIONS[type]}</dd><dt>Pourquoi ça marche</dt><dd>{pourquoi}</dd></dl>
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
            <div className="defi-card__titre"><span className="defi-card__ic"><IcSpark /></span><h2 className="t-h3">{b.nom}</h2><Pill ton="soft-violet">Bientôt</Pill></div>
            <div className="defi-card__dit"><Manta size={48} state="neutre" /><q>{b.phrase}</q></div>
            <dl className="defi-card__kv"><dt>Ce qu'on regarde</dt><dd>{b.desc}</dd></dl>
            <div className="defi-card__pied"><label className="row" style={{ gap: 10 }}><Switch on={false} onChange={() => undefined} label={`${b.nom} : bientôt disponible`} disabled /><span className="t-small">Bientôt disponible</span></label></div>
          </article>
        ))}
      </div>
    </div>
  );
}
