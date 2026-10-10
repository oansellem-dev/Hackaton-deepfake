import { useEffect, useState } from "react";
import { getEntretiens } from "../shared/api";
import { IcBell, IcCal, IcChart, IcGear, IcHome, IcRing, IcUser } from "./icons";

const ONGLETS = [
  { id: "entretiens", label: "Entretiens", href: "#/", Ic: IcHome },
  { id: "pre-verifications", label: "Pré-vérifications", href: "#/pre-verifications", Ic: IcCal },
  { id: "rapports", label: "Rapports", href: "#/rapports", Ic: IcChart },
  { id: "reglages", label: "Réglages", href: "#/reglages", Ic: IcRing },
];

export function Nav({ onglet }: { onglet: string }) {
  const [nbSignaux, setNbSignaux] = useState(0);
  useEffect(() => {
    getEntretiens().then((l) => setNbSignaux(l.reduce((n, e) => n + e.preVerification.signaux.length + (e.score?.signaux.length ?? 0), 0)));
  }, []);
  return (
    <div className="topbar">
      <div className="topbar__left">
        <a className="rbtn rbtn--yellow" href="#/" aria-label="Oval" style={{ width: 54, height: 54 }}>
          <span className="logo" style={{ fontSize: 15 }}><span className="logo__o" style={{ width: 10, height: 15, borderWidth: 2 }} aria-hidden />val</span>
        </a>
        <nav className="nav" aria-label="Navigation principale">
          {ONGLETS.map(({ id, label, href, Ic }) => (
            <a key={id} className="nav__tab" href={href} aria-current={onglet === id ? "page" : undefined}><Ic />{label}</a>
          ))}
        </nav>
      </div>
      <div className="topbar__right">
        <a className="rbtn" href="#/rapports" aria-label={`${nbSignaux} signaux à vérifier`} title="Signaux à vérifier">
          <span style={{ width: 18, height: 18, display: "inline-flex" }}><IcBell /></span>
          {nbSignaux > 0 && <span className="rbtn__count">{nbSignaux}</span>}
        </a>
        <a className="rbtn" href="#/reglages" aria-label="Profil"><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcUser /></span></a>
        <a className="rbtn" href="#/reglages" aria-label="Réglages"><span style={{ width: 18, height: 18, display: "inline-flex" }}><IcGear /></span></a>
      </div>
    </div>
  );
}
