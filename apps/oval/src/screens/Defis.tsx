import type { CSSProperties, ReactNode } from "react";
import type { DefiType } from "../store/types";
import { actions, useEtat } from "../store/store";
import { DEFI_DESCRIPTIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { Manta } from "../manta/Manta";
import { Btn, Depliant, Pill, Switch } from "../ui/ui";
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

/** Bibliothèque de défis : l'essentiel visible (phrase, interrupteur), le détail replié. */
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
        <div><h1 className="t-display">Défis</h1><p className="muted">Un geste simple demandé en visio. Un visage substitué en direct ne le suit pas.</p></div>
        <Pill ton="soft-blue" dot>{actifs.length} actif{actifs.length > 1 ? "s" : ""} sur {DEFIS.length}</Pill>
      </header>
      <section className="panel comment-wrap rise" style={{ "--i": 2 } as CSSProperties}>
        <Depliant titre="Comment ça marche ?">
          <ol className="comment">
            <li><b>1</b><span><strong>Manta propose</strong>un défi dans le panneau, en pleine visio.</span></li>
            <li><b>2</b><span><strong>Vous le demandez</strong>au candidat, avec la phrase prête à lire.</span></li>
            <li><b>3</b><span><strong>Oval observe</strong>le geste et note « réussi » ou « à vérifier ».</span></li>
            <li><b>4</b><span><strong>Vous décidez</strong>après l'entretien, dans le rapport.</span></li>
          </ol>
        </Depliant>
      </section>
      <div className="defis-grid">
        {DEFIS.map(({ type, ic, pourquoi }, i) => {
          const on = actifs.includes(type);
          const ds = tous.filter((d) => d.type === type);
          const reussis = ds.filter((d) => d.resultat === "reussi").length, averif = ds.filter((d) => d.resultat === "a_verifier").length;
          return (
            <article key={type} className={`panel defi-card rise${on ? "" : " is-off"}`} style={{ "--i": i + 2 } as CSSProperties}>
              <div className="defi-card__titre">
                <span className="defi-card__ic">{ic}</span>
                <h2 className="t-h3">{DEFI_NOMS[type]}</h2>
                <Switch on={on} onChange={() => basculer(type)} label={`${on ? "Désactiver" : "Activer"} : ${DEFI_NOMS[type]}`} />
              </div>
              <div className="defi-card__dit"><Manta size={48} state={on ? "defi" : "neutre"} /><q>{DEFI_PHRASES[type]}</q></div>
              <p className="defi-card__stat">{ds.length ? <>{ds.length} proposé{ds.length > 1 ? "s" : ""} · {reussis} réussi{reussis > 1 ? "s" : ""}{averif ? ` · ${averif} à vérifier` : ""}</> : "Pas encore proposé"}</p>
              <div className="defi-card__pied">
                <Depliant titre="Détails">
                  <dl className="defi-card__kv"><dt>Ce qu'on regarde</dt><dd>{DEFI_DESCRIPTIONS[type]}</dd><dt>Pourquoi ça marche</dt><dd>{pourquoi}</dd></dl>
                </Depliant>
                <Btn size="sm" variant="ghost" icon={<IcCopy />} onClick={() => copier(DEFI_PHRASES[type])}>Copier la phrase</Btn>
              </div>
            </article>
          );
        })}
        {BIENTOT.map((b, i) => (
          <article key={b.nom} className="panel defi-card is-bientot rise" style={{ "--i": i + 5 } as CSSProperties}>
            <div className="defi-card__titre"><span className="defi-card__ic"><IcSpark /></span><h2 className="t-h3">{b.nom}</h2><Pill ton="soft-violet">Bientôt</Pill></div>
            <div className="defi-card__dit"><Manta size={48} state="neutre" /><q>{b.phrase}</q></div>
            <p className="defi-card__stat">{b.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
