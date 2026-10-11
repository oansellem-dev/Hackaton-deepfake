import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { initiales, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { premierSignal } from "../store/statuts";
import { Avatar, Avatars, Btn, ICirc, Modal, Pill, Pop, Tabs } from "../ui/ui";
import { IcBell, IcGrid, IcList, IcPlus, IcSearch, IcSpark } from "../ui/icons";
import { NouvelEntretienForm } from "../screens/NouvelEntretien";
import { EmailPret } from "./EmailPret";
import { useMoteur } from "../store/useMoteur";
import { aller, useRoute } from "./router";
import "./shell.css";

const RAIL: { id: string; label: ReactNode; href: string }[] = [
  { id: "accueil", label: "Accueil", href: "#/" },
  { id: "entretiens", label: <>Entre-<br />tiens</>, href: "#/entretiens" },
  { id: "defis", label: "Défis", href: "#/defis" },
];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Coquille commune : rail latéral, barre du haut, fenêtre « Nouvel entretien ». */
export function Shell({ actif, children }: { actif: string; children: ReactNode }) {
  const etat = useEtat();
  useMoteur();
  const route = useRoute();
  const [nouveau, setNouveau] = useState(false);
  useEffect(() => { if (route.parts[0] === "entretiens" && route.parts[1] === "nouveau") setNouveau(true); }, [route.path, route.parts]);
  useEffect(() => { const f = () => setNouveau(true); addEventListener("oval:nouvel-entretien", f); return () => removeEventListener("oval:nouvel-entretien", f); }, []);
  const fermer = () => { setNouveau(false); if (route.parts[1] === "nouveau") aller("#/entretiens"); };
  const signaux = etat.entretiens.filter((x) => nbSignauxAVerifier(x) > 0 && x.decision.valeur === "non_prise");
  const onglet = ["accueil", "entretiens", "defis"].includes(actif) ? actif : "";
  const demo = etat.reglages.donnees !== "moteur";

  return (
    <div className="app">
      <div className="shell app__shell">
        <aside className="panel rail" aria-label="Navigation">
          <a className="rail__logo" href="#/" aria-label="Oval, accueil"><span className="logo-o" /></a>
          <div className="rail__spacer" />
          {RAIL.map((r) => <a key={r.id} className="rail__item" href={r.href} aria-current={actif === r.id ? "page" : undefined}>{r.label}</a>)}
          <div className="rail__spacer" />
          <a className="rail__item" href="#/reglages" aria-current={actif === "reglages" ? "page" : undefined}>Réglages</a>
        </aside>

        <div className="app__main">
          <header className="panel topbar rise" style={{ "--i": 0 } as CSSProperties}>
            <Tabs pills value={onglet} onChange={(id) => aller(id === "accueil" ? "#/" : `#/${id}`)} items={[
              { id: "accueil", label: "Tableau de bord", icon: <IcGrid /> },
              { id: "entretiens", label: "Entretiens", icon: <IcList /> },
              { id: "defis", label: "Défis", icon: <IcSpark /> },
            ]} />
            <Recherche />
            <div className="topbar__spacer" />
            <Avatars>{etat.recruteurs.map((r) => <Avatar key={r.id} initiales={r.initiales} couleur={r.couleur} title={`Équipe : ${r.nom}`} />)}</Avatars>
            <Btn icon={<IcPlus />} onClick={() => setNouveau(true)}>Nouvel entretien</Btn>
            {demo && <a className="pill pill--soft-gold topbar__demo" href="#/reglages" title="Données d'exemple, tout en local. Changer dans Réglages.">Démo</a>}
            <div className="topbar__spacer" />
            <Cloche signaux={signaux} />
          </header>
          <main className="page app__page" key={route.path}>{children}</main>
        </div>
      </div>
      <Modal open={nouveau} onClose={fermer} title="Nouvel entretien"><NouvelEntretienForm onDone={fermer} /></Modal>
      <EmailPret />
    </div>
  );
}

function Recherche() {
  const etat = useEtat();
  const [q, setQ] = useState("");
  const res = q.trim() ? etat.entretiens.filter((x) => norm(`${nomComplet(x)} ${x.candidat.poste} ${x.candidat.email}`).includes(norm(q.trim()))).slice(0, 6) : [];
  const ouvrir = (x: Entretien, close: () => void) => { aller(`#/rapport/${x.id}`); close(); setQ(""); };
  return (
    <Pop width={340} button={({ open, toggle }) => <ICirc label="Rechercher un candidat" active={open} onClick={toggle}><IcSearch /></ICirc>}>
      {(close) => (
        <>
          <label className="search search--menu"><IcSearch width={16} height={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, poste ou e-mail" aria-label="Rechercher un candidat" onKeyDown={(e) => { if (e.key === "Enter" && res[0]) ouvrir(res[0], close); }} /></label>
          {q.trim() && !res.length && <div className="menu__empty">Aucun candidat ne correspond.</div>}
          {res.map((x) => (
            <button key={x.id} type="button" className="menu__item" onClick={() => ouvrir(x, close)}>
              <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} />
              <span className="grow">{nomComplet(x)}<span className="menu__sub" style={{ display: "block" }}>{x.candidat.poste}</span></span>
            </button>
          ))}
          {!q.trim() && <div className="menu__empty">Tapez un nom pour ouvrir son rapport.</div>}
        </>
      )}
    </Pop>
  );
}

function Cloche({ signaux }: { signaux: Entretien[] }) {
  return (
    <Pop align="right" width={360} button={({ open, toggle }) => <ICirc label={`Signaux à vérifier : ${signaux.length}`} active={open} badge={signaux.length || undefined} onClick={toggle}><IcBell /></ICirc>}>
      {(close) => (
        <>
          <div className="menu__title">Signaux à vérifier</div>
          {!signaux.length && <div className="menu__empty">Rien à vérifier pour l'instant.</div>}
          {signaux.map((x) => (
            <button key={x.id} type="button" className="menu__item" onClick={() => { aller(`#/rapport/${x.id}`); close(); }}>
              <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} />
              <span className="grow">{nomComplet(x)}<span className="menu__sub" style={{ display: "block" }}>{premierSignal(x)}</span></span>
              <Pill ton="soft-gold" dot>À vérifier</Pill>
            </button>
          ))}
        </>
      )}
    </Pop>
  );
}
