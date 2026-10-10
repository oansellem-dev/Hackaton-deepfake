import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Entretien } from "../store/types";
import { aujourdhui, initiales, memeJour, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { quand, relatif } from "../store/format";
import { DECISIONS_COURT } from "../store/texts";
import { doux, statutEntretien, statutPreVerif } from "../store/statuts";
import { envoyerPreVerif } from "../store/envoi";
import { Avatar, Btn, Pill, Pop, Tabs, Vide, transition, type Ton } from "../ui/ui";
import { IcArrowUR, IcArrowR, IcCheck, IcChevron, IcDots, IcFilter, IcFlag, IcRefresh, IcSort, IcX } from "../ui/icons";
import { aller, useRoute } from "../app/router";
import { NouvelEntretienForm } from "./NouvelEntretien";
import "./entretiens.css";

type Filtre = "tous" | "avenir" | "signal" | "verifiee" | "termines" | "aujourdhui" | "preverif";
const ONGLETS: Filtre[] = ["tous", "avenir", "signal", "verifiee"];
const LIBELLES: Record<Filtre, string> = { tous: "Tous", avenir: "À venir", signal: "Signal à vérifier", verifiee: "Présence vérifiée", termines: "Terminés", aujourdhui: "Aujourd'hui", preverif: "Pré-vérification en attente" };
const TEST: Record<Filtre, (x: Entretien, ref: Date) => boolean> = {
  tous: () => true,
  avenir: (x) => x.statut !== "termine",
  signal: (x) => nbSignauxAVerifier(x) > 0,
  verifiee: (x, ref) => x.statut === "termine" && statutEntretien(x, ref).texte === "Présence vérifiée",
  termines: (x) => x.statut === "termine",
  aujourdhui: (x, ref) => memeJour(new Date(x.date), ref),
  preverif: (x) => x.statut !== "termine" && (x.preVerification.statut === "envoyee" || x.preVerification.statut === "ouverte"),
};
const valide = (f?: string): Filtre => (f && f in TEST ? (f as Filtre) : "tous");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const icPv = (ton: Ton) => (ton === "soft-green" ? <IcCheck /> : ton === "soft-gold" ? <IcFlag /> : ton === "soft-violet" ? <IcArrowR /> : <IcDots />);

export function Entretiens() {
  const etat = useEtat();
  const ref = aujourdhui(etat);
  const route = useRoute();
  const [filtre, setFiltre] = useState<Filtre>(() => valide(route.query.filtre));
  const [poste, setPoste] = useState(route.query.poste ?? "");
  const [q, setQ] = useState(route.query.q ?? "");
  const [tri, setTri] = useState<"asc" | "desc">("asc");
  // Les liens (Manta, accueil, cloche) arrivent par l'adresse
  useEffect(() => { setFiltre(valide(route.query.filtre)); setPoste(route.query.poste ?? ""); setQ(route.query.q ?? ""); }, [route.query.filtre, route.query.poste, route.query.q]);
  const majUrl = (f: Filtre, p: string, r: string) => {
    const qs = new URLSearchParams({ ...(f !== "tous" ? { filtre: f } : {}), ...(p ? { poste: p } : {}), ...(r ? { q: r } : {}) }).toString();
    history.replaceState(null, "", `#/entretiens${qs ? `?${qs}` : ""}`);
  };
  const changer = (f: Filtre, p = poste, r = q) => transition(() => { setFiltre(f); setPoste(p); setQ(r); majUrl(f, p, r); });

  const base = etat.entretiens.filter((x) => (!poste || x.candidat.poste === poste) && (!q || norm(`${nomComplet(x)} ${x.candidat.poste} ${x.candidat.email}`).includes(norm(q))));
  const liste = base.filter((x) => TEST[filtre](x, ref)).sort((a, b) => (tri === "asc" ? 1 : -1) * (+new Date(a.date) - +new Date(b.date)));
  const postes = [...new Set(etat.entretiens.map((x) => x.candidat.poste))].sort((a, b) => a.localeCompare(b, "fr"));
  const ouvrir = (x: Entretien) => aller(`#/rapport/${x.id}`);
  const clavier = (e: KeyboardEvent, x: Entretien) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(x); } };
  const attente = etat.entretiens.filter((x) => TEST.preverif(x, ref)).sort((a, b) => +new Date(a.preVerification.envoyeeLe ?? a.creeLe) - +new Date(b.preVerification.envoyeeLe ?? b.creeLe));

  return (
    <div className="ent">
      <section className="panel ent__liste rise" style={{ "--i": 1 } as CSSProperties}>
        <header className="ent__head">
          <h1 className="t-display">Entretiens</h1>
          <div className="ent__tools">
            <Pop align="right" width={280} button={({ open, toggle }) => <Btn icon={<IcFilter />} onClick={toggle} aria-expanded={open}>Poste : {poste || "tous"} <IcChevron /></Btn>}>
              {(close) => (
                <>
                  <div className="menu__title">Poste</div>
                  <button type="button" className="menu__item" aria-current={!poste} onClick={() => { changer(filtre, ""); close(); }}>Tous les postes</button>
                  {postes.map((p) => <button key={p} type="button" className="menu__item" aria-current={poste === p} onClick={() => { changer(filtre, p); close(); }}>{p}</button>)}
                </>
              )}
            </Pop>
            <Btn icon={<IcSort />} onClick={() => transition(() => setTri((t) => (t === "asc" ? "desc" : "asc")))} aria-label={tri === "asc" ? "Trier du plus récent au plus ancien" : "Trier du plus ancien au plus récent"}>Date {tri === "asc" ? "↑" : "↓"}</Btn>
          </div>
        </header>
        <div className="ent__filtres">
          <Tabs pills value={ONGLETS.includes(filtre) ? filtre : ""} onChange={(id) => changer(id as Filtre)} items={ONGLETS.map((f) => ({ id: f, label: LIBELLES[f], count: base.filter((x) => TEST[f](x, ref)).length }))} />
          {!ONGLETS.includes(filtre) && <button type="button" className="pill pill--soft-blue ent__chip" onClick={() => changer("tous")}>{LIBELLES[filtre]} <IcX /></button>}
          {q && <button type="button" className="pill pill--soft-blue ent__chip" onClick={() => changer(filtre, poste, "")}>Recherche : {q} <IcX /></button>}
        </div>
        <ul className="ent-list">
          {liste.map((x, i) => {
            const pv = statutPreVerif(x, ref);
            const st = statutEntretien(x, ref);
            return (
              <li key={x.id} className="card lift ent-row rise" role="link" tabIndex={0} aria-label={`Rapport de ${nomComplet(x)}`} style={{ "--i": Math.min(i, 8), viewTransitionName: `ent-${x.id}` } as CSSProperties} onClick={() => ouvrir(x)} onKeyDown={(e) => clavier(e, x)}>
                <div className="ent-row__who"><Avatar initiales={initiales(x)} couleur={x.candidat.couleur} /><div><strong>{nomComplet(x)}</strong><span>{x.candidat.poste}</span></div></div>
                <div className="ent-row__col"><span className="col__label">Entretien</span><span className="col__value">{quand(x.date, ref)}</span></div>
                <div className="ent-row__col"><span className="col__label">Pré-vérification</span><Pill ton={pv.ton} icon={icPv(pv.ton)}>{pv.texte}</Pill></div>
                <div className="ent-row__col"><span className="col__label">Statut</span><Pill ton={doux(st.ton)} dot>{st.texte}</Pill>{x.decision.valeur !== "non_prise" && <span className="ent-row__dec">Décision : {DECISIONS_COURT[x.decision.valeur]}</span>}</div>
                <Btn icon={<IcArrowUR />} onClick={(e) => { e.stopPropagation(); ouvrir(x); }}>Rapport</Btn>
              </li>
            );
          })}
        </ul>
        {!liste.length && <Vide titre="Aucun entretien ne correspond." texte="Changez de filtre ou de poste." action={<Btn onClick={() => changer("tous", "", "")}>Tout montrer</Btn>} />}
      </section>

      <div className="ent__droite">
        <section className="panel ent__nouvel rise" style={{ "--i": 2 } as CSSProperties}>
          <h2 className="t-h1">Nouvel entretien</h2>
          <NouvelEntretienForm />
        </section>
        <section className="panel bloc rise" style={{ "--i": 3 } as CSSProperties}>
          <h2 className="t-h2">Liens en attente</h2>
          {!attente.length ? <Vide titre="Aucun lien en attente." texte="Tous les liens envoyés ont été ouverts ou faits." /> : (
            <ul className="attente">
              {attente.map((x) => (
                <li key={x.id}>
                  <i className={`dot dot--${x.preVerification.statut === "ouverte" ? "blue" : "gold"}`} />
                  <a className="grow attente__nom" href={`#/rapport/${x.id}`}>{nomComplet(x)}</a>
                  <button type="button" className="pill attente__btn" onClick={() => void envoyerPreVerif(x.id, true)} title={`Relancer ${x.candidat.prenom} par e-mail`}>
                    <IcRefresh />{x.preVerification.statut === "ouverte" ? "Ouvert" : x.preVerification.relanceeLe ? `Relancé ${relatif(x.preVerification.relanceeLe, ref).toLowerCase()}` : `Envoyé ${relatif(x.preVerification.envoyeeLe ?? x.creeLe, ref).toLowerCase()}`} · Relancer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
