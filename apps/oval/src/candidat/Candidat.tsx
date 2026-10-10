import { useEffect } from "react";
import { actions, useEtat } from "../store/store";
import { Manta } from "../manta/Manta";
import { PreVerif } from "./PreVerif";

/**
 * Entrée de la page candidat (#/candidat/<jeton>). Le lien est unique et valable une fois,
 * jusqu'au début de l'entretien. Sur un autre ordinateur que celui du recruteur, le jeton
 * est inconnu localement : la page s'affiche quand même (le retour des résultats vers le
 * dashboard passera par le serveur de l'équipe).
 */
export function Candidat({ token }: { token?: string }) {
  const etat = useEtat();
  const x = token ? etat.entretiens.find((e) => e.preVerification.lien?.token === token || e.id === token) : undefined;
  const p = x?.preVerification;
  useEffect(() => { if (x && (p?.statut === "envoyee" || p?.statut === "non_faite")) actions.preVerifOuverte(x.id); }, [x?.id]); // eslint-disable-line
  if (x && p?.statut === "faite" && p.lien?.utiliseLe) return <LienFini titre="Cette vérification est déjà faite" texte="Merci, vous n'avez rien d'autre à faire. À tout à l'heure !" />;
  if (x && p?.lien && Date.now() > new Date(p.lien.expireLe).getTime()) return <LienFini titre="Ce lien a expiré" texte="Il était valable jusqu'au début de l'entretien. Ce n'est pas un problème : les vérifications se feront en direct." />;
  return <PreVerif token={token ?? "demo"} entretienId={x?.id} />;
}

function LienFini({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="app">
      <section className="panel en-construction rise" style={{ maxWidth: 640, margin: "8vh auto 0" }}>
        <Manta size={110} state="verifie" />
        <h1 className="t-h1">{titre}</h1>
        <p className="muted">{texte}</p>
      </section>
    </div>
  );
}
