import { useEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { Entretien } from "../store/types";
import { aujourdhui, initiales, memeJour, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { heure, quand, relatif } from "../store/format";
import { DECISIONS_COURT } from "../store/texts";
import { doux, statutEntretien, statutPreVerif } from "../store/statuts";
import { envoyerPreVerif } from "../store/envoi";
import { Avatar, Btn, Input, Pill, Pop, Tabs, Vide, transition } from "../ui/ui";
import { IcArrowR, IcCal, IcCheck, IcChevron, IcFilter, IcFlag, IcMail, IcPlay, IcRefresh, IcSearch, IcSort, IcX } from "../ui/icons";
import { aller, useRoute } from "../app/router";
import { t } from "../i18n";
import "./entretiens.css";

type Filtre = "tous" | "avenir" | "signal" | "verifiee" | "termines" | "aujourdhui" | "preverif";
const TUILES: { id: Filtre; label: string; ic: ReactNode; ton: "blue" | "gold" | "green" | "neutral" }[] = [
  { id: "tous", label: t("Tous les entretiens"), ic: <IcCal />, ton: "neutral" },
  { id: "avenir", label: t("À venir"), ic: <IcPlay />, ton: "blue" },
  { id: "signal", label: t("Signal à vérifier"), ic: <IcFlag />, ton: "gold" },
  { id: "verifiee", label: t("Présence vérifiée"), ic: <IcCheck />, ton: "green" },
];
const LIBELLES: Record<Filtre, string> = { tous: t("Tous"), avenir: t("À venir"), signal: t("Signal à vérifier"), verifiee: t("Présence vérifiée"), termines: t("Terminés"), aujourdhui: t("Aujourd'hui"), preverif: t("Pré-vérification en attente") };
const TEST: Record<Filtre, (x: Entretien, ref: Date) => boolean> = {
  tous: () => true,
  avenir: (x) => x.statut !== "termine",
  signal: (x) => nbSignauxAVerifier(x) > 0,
  verifiee: (x, ref) => x.statut === "termine" && statutEntretien(x, ref).texte === t("Présence vérifiée"),
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
        <h1 className="t-display">{t("Entretiens")}</h1>
        <Tabs raised value={speciale ? "" : filtre} onChange={(id) => changer(id as Filtre)} items={TUILES.map((tu) => ({ id: tu.id, label: tu.id === "tous" ? t("Tous") : tu.label, icon: tu.ic, count: base.filter((x) => TEST[tu.id](x, ref)).length }))} />
      </header>

      <div className="ent__corps">
        <section className="panel ent__liste rise" style={{ "--i": 3 } as CSSProperties}>
          <div className="ent__tools">
            <label className="ent__search"><IcSearch /><Input value={q} placeholder={t("Nom, poste, e-mail…")} onChange={(e) => changer(filtre, poste, e.target.value)} />{q && <button type="button" aria-label={t("Effacer")} onClick={() => changer(filtre, poste, "")}><IcX /></button>}</label>
            <Pop align="right" width={280} button={({ open, toggle }) => <Btn icon={<IcFilter />} onClick={toggle} aria-expanded={open}>{poste || t("Tous les postes")} <IcChevron /></Btn>}>
              {(close) => (
                <>
                  <div className="menu__title">{t("Poste")}</div>
                  <button type="button" className="menu__item" aria-current={!poste} onClick={() => { changer(filtre, ""); close(); }}>{t("Tous les postes")}</button>
                  {postes.map((p) => <button key={p} type="button" className="menu__item" aria-current={poste === p} onClick={() => { changer(filtre, p); close(); }}>{p}</button>)}
                </>
              )}
            </Pop>
            <Btn variant="ghost" icon={<IcSort />} onClick={() => transition(() => setTri((t) => (t === "asc" ? "desc" : "asc")))} title={tri === "asc" ? t("Plus proches d'abord") : t("Plus récents d'abord")}>{tri === "asc" ? t("Proches") : t("Récents")}</Btn>
            {speciale && <button type="button" className="pill pill--soft-blue ent__chip" onClick={() => changer("tous")}>{LIBELLES[filtre]} <IcX /></button>}
          </div>

          <div className="tbl" role="table" aria-label={t("Entretiens")}>
            <div className="tbl__head" role="row"><span>{t("Candidat")}</span><span>{t("Date")}</span><span>{t("Pré-vérification")}</span><span>{t("Statut")}</span><span /></div>
            {liste.map((x, i) => {
              const pv = statutPreVerif(x, ref);
              const st = statutEntretien(x, ref);
              const enAttente = TEST.preverif(x, ref);
              return (
                <div key={x.id} role="row" className="tbl__row rise" tabIndex={0} aria-label={t("Rapport de {nom}", { nom: nomComplet(x) })} style={{ "--i": Math.min(i, 10), viewTransitionName: `ent-${x.id}` } as CSSProperties} onClick={() => ouvrir(x)} onKeyDown={(e) => clavier(e, x)}>
                  <span className="tbl__who"><Avatar initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} /><span><b>{nomComplet(x)}</b><small>{x.candidat.poste}</small></span></span>
                  <span className="tbl__date"><b>{memeJour(new Date(x.date), ref) ? t("Aujourd'hui") : quand(x.date, ref).split(" · ")[0]}</b><small>{heure(x.date)}{x.statut === "termine" ? ` · ${x.dureeMin} min` : ""}</small></span>
                  <span><Pill ton={pv.ton} dot>{pv.texte}</Pill></span>
                  <span className="tbl__statut"><Pill ton={doux(st.ton)} dot>{st.texte}</Pill>{x.decision.valeur !== "non_prise" && <small>{t("Décision : {d}", { d: DECISIONS_COURT[x.decision.valeur] })}</small>}</span>
                  <span className="tbl__act">
                    {enAttente && <button type="button" className="icirc icirc--sm" title={t("Relancer le lien par e-mail")} aria-label={t("Relancer le lien")} onClick={(e) => { e.stopPropagation(); void envoyerPreVerif(x.id, true); }}><IcRefresh /></button>}
                    {x.preVerification.statut === "non_envoyee" && x.statut !== "termine" && <button type="button" className="icirc icirc--sm" title={t("Envoyer le lien de pré-vérification")} aria-label={t("Envoyer le lien")} onClick={(e) => { e.stopPropagation(); void envoyerPreVerif(x.id); }}><IcMail /></button>}
                    <span className="icirc icirc--sm tbl__go"><IcArrowR /></span>
                  </span>
                </div>
              );
            })}
          </div>
          {!liste.length && <Vide titre={t("Aucun entretien ne correspond.")} texte={t("Changez de filtre, de poste ou de recherche.")} action={<Btn onClick={() => changer("tous", "", "")}>{t("Tout montrer")}</Btn>} />}
        </section>

        <aside className="panel ent__attente rise" style={{ "--i": 4 } as CSSProperties}>
          <div className="row" style={{ justifyContent: "space-between" }}><h2 className="t-h3">{t("Liens en attente")}</h2><Pill ton={attente.length ? "soft-gold" : "soft-green"}>{attente.length}</Pill></div>
          <p className="t-small muted">{t("Candidats qui n'ont pas encore fait leur pré-vérification.")}</p>
          {!attente.length ? <Vide titre={t("Aucun lien en attente.")} /> : (
            <ul className="attente">
              {attente.map((x) => (
                <li key={x.id}>
                  <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} size="sm" />
                  <span className="attente__txt"><a href={`#/rapport/${x.id}`}>{nomComplet(x)}</a><small>{x.preVerification.statut === "ouverte" ? t("Lien ouvert, pas terminé") : x.preVerification.relanceeLe ? t("Relancé {quand}", { quand: relatif(x.preVerification.relanceeLe, ref).toLowerCase() }) : t("Envoyé {quand}", { quand: relatif(x.preVerification.envoyeeLe ?? x.creeLe, ref).toLowerCase() })}{" · "}{t("entretien {quand}", { quand: quand(x.date, ref).toLowerCase() })}</small></span>
                  <Btn size="sm" icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>{t("Relancer")}</Btn>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
