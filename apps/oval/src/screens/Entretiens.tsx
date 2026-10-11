import { useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { aujourdhui, initiales, memeJour, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { heure, quand, relatif } from "../store/format";
import { DECISIONS_COURT } from "../store/texts";
import { doux, statutEntretien, statutPreVerif } from "../store/statuts";
import { envoyerPreVerif } from "../store/envoi";
import { ouvrirNouvelEntretien } from "../app/events";
import { Avatar, Btn, Input, Pill, Pop, Vide, transition } from "../ui/ui";
import { IcArrowR, IcCal, IcCheck, IcChevron, IcFilter, IcFlag, IcMail, IcPlay, IcPlus, IcRefresh, IcSearch, IcSort, IcX } from "../ui/icons";
import { aller, useRoute } from "../app/router";
import "./entretiens.css";

type Filtre = "tous" | "avenir" | "signal" | "verifiee" | "termines" | "aujourdhui" | "preverif";
const TUILES: { id: Filtre; label: string; ic: ReactNode; ton: "blue" | "gold" | "green" | "neutral" }[] = [
  { id: "tous", label: "Tous les entretiens", ic: <IcCal />, ton: "neutral" },
  { id: "avenir", label: "À venir", ic: <IcPlay />, ton: "blue" },
  { id: "signal", label: "Signal à vérifier", ic: <IcFlag />, ton: "gold" },
  { id: "verifiee", label: "Présence vérifiée", ic: <IcCheck />, ton: "green" },
];
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
  const speciale = !TUILES.some((t) => t.id === filtre);

  return (
    <div className="ent">
      <header className="ent__head rise" style={{ "--i": 1 } as CSSProperties}>
        <div><h1 className="t-display">Entretiens</h1><p className="muted">Cliquez sur une ligne pour ouvrir le rapport.</p></div>
        <Btn variant="primary" icon={<IcPlus />} onClick={ouvrirNouvelEntretien}>Nouvel entretien</Btn>
      </header>

      <div className="ent__tuiles rise" style={{ "--i": 2 } as CSSProperties}>
        {TUILES.map((t) => {
          const n = base.filter((x) => TEST[t.id](x, ref)).length;
          return (
            <button key={t.id} type="button" className={`panel etuile etuile--${t.ton}${filtre === t.id ? " is-on" : ""}`} aria-pressed={filtre === t.id} onClick={() => changer(t.id)}>
              <span className="etuile__ic">{t.ic}</span><b className="num">{n}</b><span className="etuile__label">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="ent__corps">
        <section className="panel ent__liste rise" style={{ "--i": 3 } as CSSProperties}>
          <div className="ent__tools">
            <label className="ent__search"><IcSearch /><Input value={q} placeholder="Nom, poste, e-mail…" onChange={(e) => changer(filtre, poste, e.target.value)} />{q && <button type="button" aria-label="Effacer" onClick={() => changer(filtre, poste, "")}><IcX /></button>}</label>
            <Pop align="right" width={280} button={({ open, toggle }) => <Btn icon={<IcFilter />} onClick={toggle} aria-expanded={open}>{poste || "Tous les postes"} <IcChevron /></Btn>}>
              {(close) => (
                <>
                  <div className="menu__title">Poste</div>
                  <button type="button" className="menu__item" aria-current={!poste} onClick={() => { changer(filtre, ""); close(); }}>Tous les postes</button>
                  {postes.map((p) => <button key={p} type="button" className="menu__item" aria-current={poste === p} onClick={() => { changer(filtre, p); close(); }}>{p}</button>)}
                </>
              )}
            </Pop>
            <Btn icon={<IcSort />} onClick={() => transition(() => setTri((t) => (t === "asc" ? "desc" : "asc")))}>{tri === "asc" ? "Plus proches d'abord" : "Plus récents d'abord"}</Btn>
            {speciale && <button type="button" className="pill pill--soft-blue ent__chip" onClick={() => changer("tous")}>{LIBELLES[filtre]} <IcX /></button>}
          </div>

          <div className="tbl" role="table" aria-label="Entretiens">
            <div className="tbl__head" role="row"><span>Candidat</span><span>Date</span><span>Pré-vérification</span><span>Statut</span><span /></div>
            {liste.map((x, i) => {
              const pv = statutPreVerif(x, ref);
              const st = statutEntretien(x, ref);
              const enAttente = TEST.preverif(x, ref);
              return (
                <div key={x.id} role="row" className="tbl__row rise" tabIndex={0} aria-label={`Rapport de ${nomComplet(x)}`} style={{ "--i": Math.min(i, 10), viewTransitionName: `ent-${x.id}` } as CSSProperties} onClick={() => ouvrir(x)} onKeyDown={(e) => clavier(e, x)}>
                  <span className="tbl__who"><Avatar initiales={initiales(x)} couleur={x.candidat.couleur} /><span><b>{nomComplet(x)}</b><small>{x.candidat.poste}</small></span></span>
                  <span className="tbl__date"><b>{memeJour(new Date(x.date), ref) ? "Aujourd'hui" : quand(x.date, ref).split(" · ")[0]}</b><small>{heure(x.date)}{x.statut === "termine" ? ` · ${x.dureeMin} min` : ""}</small></span>
                  <span><Pill ton={pv.ton} dot>{pv.texte}</Pill></span>
                  <span className="tbl__statut"><Pill ton={doux(st.ton)} dot>{st.texte}</Pill>{x.decision.valeur !== "non_prise" && <small>Décision : {DECISIONS_COURT[x.decision.valeur]}</small>}</span>
                  <span className="tbl__act">
                    {enAttente && <button type="button" className="icirc icirc--sm" title="Relancer le lien par e-mail" aria-label="Relancer le lien" onClick={(e) => { e.stopPropagation(); void envoyerPreVerif(x.id, true); }}><IcRefresh /></button>}
                    {x.preVerification.statut === "non_envoyee" && x.statut !== "termine" && <button type="button" className="icirc icirc--sm" title="Envoyer le lien de pré-vérification" aria-label="Envoyer le lien" onClick={(e) => { e.stopPropagation(); void envoyerPreVerif(x.id); }}><IcMail /></button>}
                    <span className="icirc icirc--sm tbl__go"><IcArrowR /></span>
                  </span>
                </div>
              );
            })}
          </div>
          {!liste.length && <Vide titre="Aucun entretien ne correspond." texte="Changez de filtre, de poste ou de recherche." action={<Btn onClick={() => changer("tous", "", "")}>Tout montrer</Btn>} />}
        </section>

        <aside className="panel ent__attente rise" style={{ "--i": 4 } as CSSProperties}>
          <div className="row" style={{ justifyContent: "space-between" }}><h2 className="t-h3">Liens en attente</h2><Pill ton={attente.length ? "soft-gold" : "soft-green"}>{attente.length}</Pill></div>
          <p className="t-small muted">Candidats qui n'ont pas encore fait leur pré-vérification.</p>
          {!attente.length ? <Vide titre="Aucun lien en attente." /> : (
            <ul className="attente">
              {attente.map((x) => (
                <li key={x.id}>
                  <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} size="sm" />
                  <span className="attente__txt"><a href={`#/rapport/${x.id}`}>{nomComplet(x)}</a><small>{x.preVerification.statut === "ouverte" ? "Lien ouvert, pas terminé" : x.preVerification.relanceeLe ? `Relancé ${relatif(x.preVerification.relanceeLe, ref).toLowerCase()}` : `Envoyé ${relatif(x.preVerification.envoyeeLe ?? x.creeLe, ref).toLowerCase()}`} · entretien {quand(x.date, ref).toLowerCase()}</small></span>
                  <Btn size="sm" icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>Relancer</Btn>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
