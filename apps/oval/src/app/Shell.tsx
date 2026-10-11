import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { actions, initiales, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { premierSignal } from "../store/statuts";
import { Avatar, Avatars, Btn, ICirc, Modal, Pill, Pop } from "../ui/ui";
import { IcBell, IcGear, IcHome, IcList, IcLogo, IcPlus, IcSearch, IcSpark } from "../ui/icons";
import { NouvelEntretienForm } from "../screens/NouvelEntretien";
import type { Creneau } from "./events";
import { EmailPret } from "./EmailPret";
import { useMoteur } from "../store/useMoteur";
import { aller, useRoute } from "./router";
import { envoyerCreneau } from "../store/moteur";
import { heure, jourLong } from "../store/format";
import { toast } from "../ui/toast";
import { t } from "../i18n";
import "./shell.css";

const RAIL: { id: string; label: string; icone: ReactNode; href: string }[] = [
  { id: "accueil", label: t("Accueil"), icone: <IcHome />, href: "#/" },
  { id: "entretiens", label: t("Entretiens"), icone: <IcList />, href: "#/entretiens" },
  { id: "defis", label: t("Défis"), icone: <IcSpark />, href: "#/defis" },
];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Coquille commune : rail latéral, barre du haut, fenêtre « Nouvel entretien ». */
export function Shell({ actif, children }: { actif: string; children: ReactNode }) {
  const etat = useEtat();
  useMoteur();
  const route = useRoute();
  const [nouveau, setNouveau] = useState(false);
  const [creneau, setCreneau] = useState<Creneau | undefined>();
  useEffect(() => { if (route.parts[0] === "entretiens" && route.parts[1] === "nouveau") setNouveau(true); }, [route.path, route.parts]);
  useEffect(() => { const f = (e: Event) => { setCreneau((e as CustomEvent<Creneau | undefined>).detail); setNouveau(true); }; addEventListener("oval:nouvel-entretien", f); return () => removeEventListener("oval:nouvel-entretien", f); }, []);
  const fermer = () => { setNouveau(false); if (route.parts[1] === "nouveau") aller("#/entretiens"); };
  const signaux = etat.entretiens.filter((x) => nbSignauxAVerifier(x) > 0 && x.decision.valeur === "non_prise");
  const propositions = etat.entretiens.filter((x) => x.statut !== "termine" && x.creneau?.statut === "propose" && x.creneau.propose);
  const titre = { accueil: t("Tableau de bord"), entretiens: t("Entretiens"), defis: t("Défis"), reglages: t("Réglages") }[actif] ?? "Oval";

  return (
    <div className="app">
      <div className="shell app__shell">
        <aside className="panel rail" aria-label={t("Navigation")}>
          <a className="rail__logo" href="#/" aria-label={t("Oval, accueil")}><IcLogo className="logo-mark" /></a>
          <div className="rail__spacer" />
          {RAIL.map((r) => <a key={r.id} className="rail__item" href={r.href} aria-label={r.label} title={r.label} aria-current={actif === r.id ? "page" : undefined}>{r.icone}</a>)}
          <div className="rail__spacer" />
          <a className="rail__item" href="#/reglages" aria-label={t("Réglages")} title={t("Réglages")} aria-current={actif === "reglages" ? "page" : undefined}><IcGear /></a>
        </aside>

        <div className="app__main">
          <header className="panel topbar rise" style={{ "--i": 0 } as CSSProperties}>
            <span className="topbar__titre">{titre}</span>
            <div className="topbar__spacer" />
            <Recherche />
            <Cloche signaux={signaux} propositions={propositions} />
            <Avatars>{etat.recruteurs.map((r) => <Avatar key={r.id} initiales={r.initiales} couleur={r.couleur} photo={r.photo} title={t("Équipe : {nom}", { nom: r.nom })} />)}</Avatars>
            <Btn variant="primary" icon={<IcPlus />} onClick={() => { setCreneau(undefined); setNouveau(true); }}>{t("Nouvel entretien")}</Btn>
          </header>
          <main className="page app__page" key={route.path}>{children}</main>
        </div>
      </div>
      <Modal open={nouveau} onClose={fermer} title={t("Nouvel entretien")}><NouvelEntretienForm key={creneau ? `${creneau.date}T${creneau.heure}` : "libre"} initial={creneau} onDone={fermer} /></Modal>
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
    <Pop width={340} button={({ open, toggle }) => <ICirc label={t("Rechercher un candidat")} active={open} onClick={toggle}><IcSearch /></ICirc>}>
      {(close) => (
        <>
          <label className="search search--menu"><IcSearch width={16} height={16} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Nom, poste ou e-mail")} aria-label={t("Rechercher un candidat")} onKeyDown={(e) => { if (e.key === "Enter" && res[0]) ouvrir(res[0], close); }} /></label>
          {q.trim() && !res.length && <div className="menu__empty">{t("Aucun candidat ne correspond.")}</div>}
          {res.map((x) => (
            <button key={x.id} type="button" className="menu__item" onClick={() => ouvrir(x, close)}>
              <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} />
              <span className="grow">{nomComplet(x)}<span className="menu__sub" style={{ display: "block" }}>{x.candidat.poste}</span></span>
            </button>
          ))}
          {!q.trim() && <div className="menu__empty">{t("Tapez un nom pour ouvrir son rapport.")}</div>}
        </>
      )}
    </Pop>
  );
}

function Cloche({ signaux, propositions }: { signaux: Entretien[]; propositions: Entretien[] }) {
  const total = signaux.length + propositions.length;
  const accepter = async (x: Entretien) => {
    actions.deplacer(x.id, x.creneau!.propose!);
    try { await envoyerCreneau(x.id); toast(t("{prenom} : créneau accepté, {jour} à {heure}", { prenom: x.candidat.prenom, jour: jourLong(x.creneau!.propose!), heure: heure(x.creneau!.propose!) })); } catch { toast(t("Moteur injoignable, réessayez")); }
  };
  const garder = async (x: Entretien) => {
    try { await envoyerCreneau(x.id); toast(t("Créneau initial conservé pour {prenom}", { prenom: x.candidat.prenom })); } catch { toast(t("Moteur injoignable, réessayez")); }
  };
  return (
    <Pop align="right" width={380} button={({ open, toggle }) => <ICirc label={t("Notifications : {n}", { n: total })} active={open} badge={total || undefined} onClick={toggle}><IcBell /></ICirc>}>
      {(close) => (
        <>
          {propositions.length > 0 && <div className="menu__title">{t("Créneaux proposés par les candidats")}</div>}
          {propositions.map((x) => (
            <div key={`c-${x.id}`} className="menu__item menu__item--bloc">
              <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} />
              <span className="grow">{nomComplet(x)}<span className="menu__sub" style={{ display: "block" }}>{t("Propose {jour} à {heure}", { jour: jourLong(x.creneau!.propose!), heure: heure(x.creneau!.propose!) })}{x.creneau!.message ? ` · ${t("« {message} »", { message: x.creneau!.message })}` : ""}</span>
                <span className="row" style={{ gap: 6, marginTop: 6 }}><Btn size="sm" variant="primary" onClick={() => void accepter(x)}>{t("Accepter")}</Btn><Btn size="sm" variant="ghost" onClick={() => void garder(x)}>{t("Garder le mien")}</Btn></span>
              </span>
            </div>
          ))}
          <div className="menu__title">{t("Signaux à vérifier")}</div>
          {!signaux.length && <div className="menu__empty">{t("Rien à vérifier pour l'instant.")}</div>}
          {signaux.map((x) => (
            <button key={x.id} type="button" className="menu__item" onClick={() => { aller(`#/rapport/${x.id}`); close(); }}>
              <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} />
              <span className="grow">{nomComplet(x)}<span className="menu__sub" style={{ display: "block" }}>{premierSignal(x)}</span></span>
              <Pill ton="soft-gold" dot>{t("À vérifier")}</Pill>
            </button>
          ))}
        </>
      )}
    </Pop>
  );
}
