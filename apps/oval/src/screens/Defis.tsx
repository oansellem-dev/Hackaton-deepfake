import type { CSSProperties, ReactNode } from "react";
import type { DefiType } from "../store/types";
import { actions, useEtat } from "../store/store";
import { DEFI_DESCRIPTIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { Manta } from "../manta/Manta";
import { Btn, Depliant, Pill, Switch } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcCopy, IcHand, IcMic, IcRefresh, IcSpark } from "../ui/icons";
import { t } from "../i18n";
import "./pages.css";

const DEFIS: { type: DefiType; ic: ReactNode; pourquoi: string }[] = [
  { type: "main_devant_visage", ic: <IcHand />, pourquoi: t("Un visage substitué en direct se déchire quand une main passe devant.") },
  { type: "rotation_tete", ic: <IcRefresh />, pourquoi: t("De profil, un masque numérique perd ses repères et se déforme.") },
  { type: "phrase_aleatoire", ic: <IcMic />, pourquoi: t("Une phrase imprévisible : les lèvres et le son doivent rester alignés.") },
];
const BIENTOT = [
  { nom: t("Montrer un nombre de doigts"), phrase: t("Pouvez-vous montrer trois doigts devant la caméra ?"), desc: t("Un nombre tiré au hasard : la main doit apparaître nette devant le visage.") },
  { nom: t("Se rapprocher de la caméra"), phrase: t("Pouvez-vous vous rapprocher un instant de la caméra ?"), desc: t("Le changement de distance fait varier la netteté : un visage substitué décroche.") },
];

/** Bibliothèque de défis : l'essentiel visible (phrase, interrupteur), le détail replié. */
export function Defis() {
  const etat = useEtat();
  const actifs = etat.reglages.defisActifs;
  const tous = etat.entretiens.flatMap((x) => x.defis);
  const basculer = (type: DefiType) => {
    const on = actifs.includes(type);
    if (on && actifs.length === 1) { toast(t("Gardez au moins un défi actif")); return; }
    actions.reglages({ defisActifs: on ? actifs.filter((y) => y !== type) : [...actifs, type] });
    toast(on ? t("Défi désactivé : {defi}", { defi: DEFI_NOMS[type].toLowerCase() }) : t("Défi activé : {defi}", { defi: DEFI_NOMS[type].toLowerCase() }));
  };
  const copier = (txt: string) => navigator.clipboard.writeText(txt).then(() => toast(t("Phrase copiée")), () => toast(t("Copie impossible sur ce navigateur")));
  return (
    <div className="pages">
      <header className="page-head rise" style={{ "--i": 1 } as CSSProperties}>
        <div><h1 className="t-display">{t("Défis")}</h1><p className="muted">{t("Un geste simple demandé en visio. Un visage substitué en direct ne le suit pas.")}</p></div>
        <Pill ton="soft-blue" dot>{actifs.length > 1 ? t("{n} actifs sur {total}", { n: actifs.length, total: DEFIS.length }) : t("{n} actif sur {total}", { n: actifs.length, total: DEFIS.length })}</Pill>
      </header>
      <section className="panel comment-wrap rise" style={{ "--i": 2 } as CSSProperties}>
        <Depliant titre={t("Comment ça marche ?")}>
          <ol className="comment">
            <li><b>1</b><span><strong>{t("Manta propose")}</strong>{t("un défi dans le panneau, en pleine visio.")}</span></li>
            <li><b>2</b><span><strong>{t("Vous le demandez")}</strong>{t("au candidat, avec la phrase prête à lire.")}</span></li>
            <li><b>3</b><span><strong>{t("Oval observe")}</strong>{t("le geste et note « réussi » ou « à vérifier ».")}</span></li>
            <li><b>4</b><span><strong>{t("Vous décidez")}</strong>{t("après l'entretien, dans le rapport.")}</span></li>
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
                <Switch on={on} onChange={() => basculer(type)} label={on ? t("Désactiver : {defi}", { defi: DEFI_NOMS[type] }) : t("Activer : {defi}", { defi: DEFI_NOMS[type] })} />
              </div>
              <div className="defi-card__dit"><Manta size={48} state={on ? "defi" : "neutre"} /><q>{DEFI_PHRASES[type]}</q></div>
              <p className="defi-card__stat">{ds.length ? <>{ds.length > 1 ? t("{n} proposés", { n: ds.length }) : t("{n} proposé", { n: ds.length })} · {reussis > 1 ? t("{n} réussis", { n: reussis }) : t("{n} réussi", { n: reussis })}{averif ? ` · ${t("{n} à vérifier", { n: averif })}` : ""}</> : t("Pas encore proposé")}</p>
              <div className="defi-card__pied">
                <Depliant titre={t("Détails")}>
                  <dl className="defi-card__kv"><dt>{t("Ce qu'on regarde")}</dt><dd>{DEFI_DESCRIPTIONS[type]}</dd><dt>{t("Pourquoi ça marche")}</dt><dd>{pourquoi}</dd></dl>
                </Depliant>
                <Btn size="sm" variant="ghost" icon={<IcCopy />} onClick={() => copier(DEFI_PHRASES[type])}>{t("Copier la phrase")}</Btn>
              </div>
            </article>
          );
        })}
        {BIENTOT.map((b, i) => (
          <article key={b.nom} className="panel defi-card is-bientot rise" style={{ "--i": i + 5 } as CSSProperties}>
            <div className="defi-card__titre"><span className="defi-card__ic"><IcSpark /></span><h2 className="t-h3">{b.nom}</h2><Pill ton="soft-violet">{t("Bientôt")}</Pill></div>
            <div className="defi-card__dit"><Manta size={48} state="neutre" /><q>{b.phrase}</q></div>
            <p className="defi-card__stat">{b.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
