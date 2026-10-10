import { useEffect, useState } from "react";
import { getEntretiens } from "../shared/api";

const ONGLETS = [
  { id: "entretiens", label: "Entretiens", href: "#/" },
  { id: "pre-verifications", label: "Pré-vérifications", href: "#/pre-verifications" },
  { id: "rapports", label: "Rapports", href: "#/rapports" },
  { id: "reglages", label: "Réglages", href: "#/reglages" },
];

export function Nav({ onglet }: { onglet: string }) {
  const [vue, setVue] = useState<"moi" | "equipe">("equipe");
  const [nbSignaux, setNbSignaux] = useState(0);
  useEffect(() => {
    getEntretiens().then((l) => setNbSignaux(l.reduce((n, e) => n + e.preVerification.signaux.length + (e.score?.signaux.length ?? 0), 0)));
  }, []);
  return (
    <nav className="nav" aria-label="Navigation principale">
      <a className="logo" href="#/" aria-label="Oval"><span className="logo__o" aria-hidden />val</a>
      <div className="nav__tabs">
        {ONGLETS.map((o) => (
          <a key={o.id} className="nav__tab" href={o.href} aria-current={onglet === o.id ? "page" : undefined}>{o.label}</a>
        ))}
      </div>
      <div className="nav__right">
        <div className="toggle" role="group" aria-label="Vue" data-pos={vue === "moi" ? "0" : "1"}>
          <button aria-pressed={vue === "moi"} onClick={() => setVue("moi")}>Moi</button>
          <button aria-pressed={vue === "equipe"} onClick={() => setVue("equipe")}>Équipe</button>
        </div>
        <a className="bell" href="#/rapports" aria-label={`${nbSignaux} signaux à vérifier`} title="Signaux à vérifier">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          {nbSignaux > 0 && <span className="bell__count">{nbSignaux}</span>}
        </a>
      </div>
    </nav>
  );
}
