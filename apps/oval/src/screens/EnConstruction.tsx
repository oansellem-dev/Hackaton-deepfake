import { Manta } from "../manta/Manta";
import { Btn } from "../ui/ui";
import { toast } from "../ui/toast";
import { actions } from "../store/store";
import { IcArrowL, IcRefresh } from "../ui/icons";
import { t } from "../i18n";

/** Écran pas encore construit : honnête, avec un retour et (dans Réglages) la remise à zéro de la démo. */
export function EnConstruction({ titre, etape, texte, reset }: { titre: string; etape?: number; texte?: string; reset?: boolean }) {
  return (
    <section className="panel rise en-construction">
      <Manta size={120} />
      <h1 className="t-display">{titre}</h1>
      <p className="muted" style={{ maxWidth: 540 }}>{texte ?? t("Cet écran arrive à l'étape {etape}, une fois l'accueil validé.", { etape: String(etape) })}</p>
      <div className="row wrap" style={{ gap: 10, justifyContent: "center" }}>
        <Btn variant="primary" icon={<IcArrowL />} href="#/">{t("Retour à l'accueil")}</Btn>
        {reset && <Btn icon={<IcRefresh />} onClick={() => { actions.reinitialiser(); toast(t("Démo réinitialisée : données d'exemple rechargées")); }}>{t("Réinitialiser la démo")}</Btn>}
      </div>
    </section>
  );
}
