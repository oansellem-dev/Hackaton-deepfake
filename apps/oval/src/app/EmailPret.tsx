import { useEffect, useState } from "react";
import type { EvenementEmail } from "../store/envoi";
import { mailto } from "../store/email";
import { actions } from "../store/store";
import { Btn, Modal } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowUR, IcCopy, IcMail } from "../ui/icons";
import { Manta } from "../manta/Manta";

/** Fenêtre « E-mail prêt à partir » (envoi non configuré) ou « Aperçu de l'e-mail ». */
export function EmailPret() {
  const [ev, setEv] = useState<EvenementEmail | null>(null);
  useEffect(() => {
    const f = (e: Event) => setEv((e as CustomEvent<EvenementEmail>).detail);
    addEventListener("oval:email", f);
    return () => removeEventListener("oval:email", f);
  }, []);
  if (!ev) return null;
  const { email, detail } = ev;
  const fermer = () => setEv(null);
  const copier = () => navigator.clipboard.writeText(email.lien).then(() => toast("Lien copié"), () => toast("Copie impossible : le lien est en bas de l'aperçu"));
  return (
    <Modal open onClose={fermer} title={detail.mode === "apercu" ? "Aperçu de l'e-mail" : "E-mail prêt à partir"} width={660}>
      {detail.mode === "manuel" && (
        <div className="card email__info">
          <Manta size={48} state="defi" />
          <div>
            <strong>L'e-mail est prêt, mais il n'est pas parti tout seul.</strong>
            <p className="t-small muted">Raison : {detail.raison}. Ouvrez votre messagerie : tout est déjà rédigé, il suffit de cliquer sur Envoyer. Pour l'envoi automatique, voir « Envoi des e-mails » dans le README.</p>
          </div>
        </div>
      )}
      <dl className="email__meta"><div><dt>À</dt><dd>{email.to}</dd></div><div><dt>Objet</dt><dd>{email.subject}</dd></div></dl>
      <iframe className="email__apercu" title="Aperçu de l'e-mail" sandbox="" srcDoc={email.html} />
      <div className="email__actions">
        {detail.mode === "manuel" && <Btn variant="primary" icon={<IcMail />} href={mailto(email)} onClick={() => { toast("Messagerie ouverte : l'e-mail est prêt"); window.setTimeout(fermer, 60); }}>Ouvrir dans ma messagerie</Btn>}
        <Btn icon={<IcCopy />} onClick={copier}>Copier le lien</Btn>
        <Btn icon={<IcArrowUR />} href={email.lien} newTab>Voir la page candidat</Btn>
        {detail.mode === "manuel" && <Btn variant="ghost" onClick={() => { actions.restaurerPreVerif(detail.entretienId, detail.prev); toast("Envoi annulé"); fermer(); }}>Annuler l'envoi</Btn>}
      </div>
    </Modal>
  );
}
