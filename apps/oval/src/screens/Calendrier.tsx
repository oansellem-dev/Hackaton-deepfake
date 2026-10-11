import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from "react";
import type { Entretien } from "../store/types";
import { actions, aujourdhui, initiales, memeJour, nbSignauxAVerifier, nomComplet, useEtat } from "../store/store";
import { debutJour, estWE, heure, isoDate, jourLong, jourNom, lundi, plage, plusJours, semaineDu } from "../store/format";
import { statutEntretien, statutPreVerif } from "../store/statuts";
import { Avatar, Btn, Field, ICirc, Input, Modal, Pill, Pop, Select, transition } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowL, IcArrowR, IcArrowUR, IcCal, IcCheck, IcChevron, IcClock, IcDots, IcFilter, IcFlag, IcX } from "../ui/icons";
import { aller } from "../app/router";
import { ouvrirNouvelEntretien } from "../app/events";
import { LigneVisio } from "../ui/visio";
import { envoyerCreneau } from "../store/moteur";
import "./calendrier.css";

/**
 * Calendrier hebdomadaire des entretiens.
 *  - une colonne par jour, une grille horaire : dix rendez-vous dans la journée se rangent par heure, les chevauchements se partagent la largeur ;
 *  - glisser un entretien à venir pour le déplacer (jour et heure, au quart d'heure), tirer son bord bas pour changer la durée ;
 *  - cliquer un entretien ouvre sa fiche (date, heure, durée, rapport, suppression) ; cliquer un créneau vide crée un entretien.
 */
const H = 72;              // hauteur d'une heure (px) : un entretien de 45 min fait 54 px, assez pour tout lire
const PAS = 15;            // grain de déplacement (min)
const JOUR = 86400000;
const v = (o: Record<string, string | number | undefined>) => o as CSSProperties;
const minutes = (iso: string) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const arrondi = (m: number) => Math.round(m / PAS) * PAS;

type Filtre = "signal" | "attente" | "avenir" | "termines";
const FILTRES: { id: Filtre; label: string; test: (x: Entretien) => boolean }[] = [
  { id: "signal", label: "Signal à vérifier", test: (x) => nbSignauxAVerifier(x) > 0 },
  { id: "attente", label: "Pré-vérification en attente", test: (x) => x.statut !== "termine" && (x.preVerification.statut === "envoyee" || x.preVerification.statut === "ouverte") },
  { id: "avenir", label: "À venir", test: (x) => x.statut !== "termine" },
  { id: "termines", label: "Terminés", test: (x) => x.statut === "termine" },
];

interface Place { x: Entretien; debut: number; fin: number; col: number; n: number }
/** Range les entretiens d'un jour : ceux qui se chevauchent se partagent la largeur. */
function placer(liste: Entretien[]): Place[] {
  const tri = [...liste].sort((a, b) => minutes(a.date) - minutes(b.date));
  const out: Place[] = [];
  let groupe: Place[] = [], finGroupe = -1, fins: number[] = [];
  const clore = () => { groupe.forEach((p) => { p.n = fins.length; }); out.push(...groupe); groupe = []; fins = []; };
  for (const x of tri) {
    const debut = minutes(x.date), fin = debut + Math.max(x.dureeMin, 20);
    if (groupe.length && debut >= finGroupe) clore();
    let col = fins.findIndex((f) => f <= debut);
    if (col === -1) { col = fins.length; fins.push(fin); } else fins[col] = fin;
    groupe.push({ x, debut, fin, col, n: 1 });
    finGroupe = Math.max(finGroupe, fin);
  }
  if (groupe.length) clore();
  return out;
}

type Ton = "now" | "avenir" | "green" | "gold" | "neutral" | "passe";
function tonDe(x: Entretien, ref: Date): Ton {
  if (x.statut === "termine") { const st = statutEntretien(x, ref); return st.ton === "gold" ? "gold" : st.ton === "green" ? "green" : "neutral"; }
  if (new Date(x.date).getTime() + x.dureeMin * 60000 < ref.getTime()) return "passe";
  return memeJour(new Date(x.date), ref) ? "now" : "avenir";
}

export function Calendrier({ onReduire }: { onReduire?: () => void }) {
  const etat = useEtat();
  const ref = aujourdhui(etat);
  const [offset, setOffset] = useState(0);
  const [filtres, setFiltres] = useState<Filtre[]>([]);
  const [fiche, setFiche] = useState<string | null>(null);
  const [ancre, setAncre] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const section = useRef<HTMLElement>(null);
  /** Ouvre (ou ferme) la fiche d'un entretien, ancrée à sa carte dans le calendrier. */
  const ouvrirFiche = (id: string, el: HTMLElement | null) => {
    setFiche((f) => (f === id ? null : id));
    if (el && section.current) { const r = el.getBoundingClientRect(), b = section.current.getBoundingClientRect(); setAncre({ x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }); }
  };
  const [glisse, setGlisse] = useState<{ id: string; date: string; dureeMin: number; mode: "deplace" | "duree" } | null>(null);
  const grille = useRef<HTMLDivElement>(null);
  const defile = useRef<HTMLDivElement>(null);
  const start = plusJours(lundi(ref), offset * 7);

  const visibles = etat.entretiens.filter((x) => !filtres.length || FILTRES.some((f) => filtres.includes(f.id) && f.test(x)));
  const semaine = visibles.filter((x) => { const k = (debutJour(new Date(x.date)).getTime() - start.getTime()) / JOUR; return k >= 0 && k < 7; });
  // Lundi → vendredi, plus le samedi/dimanche s'il y a un entretien ou si c'est aujourd'hui
  const jours = [0, 1, 2, 3, 4, 5, 6].map((k) => plusJours(start, k)).filter((j) => !estWE(j) || memeJour(j, ref) || semaine.some((x) => memeJour(new Date(x.date), j)));
  // Plage horaire : 8 h → 19 h, élargie si besoin
  const [h0, h1] = useMemo(() => {
    const debs = semaine.map((x) => minutes(x.date)), fins = semaine.map((x) => minutes(x.date) + x.dureeMin);
    return [Math.min(8, ...debs.map((m) => Math.floor(m / 60))), Math.max(18, ...fins.map((m) => Math.ceil(m / 60)))];
  }, [semaine]);
  const heures = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i);
  const nowMin = ref.getHours() * 60 + ref.getMinutes();

  const basculer = (f: Filtre) => transition(() => setFiltres((fs) => (fs.includes(f) ? fs.filter((y) => y !== f) : [...fs, f])));
  const aller_ = (o: number) => transition(() => { setOffset(o); setFiche(null); });

  /* ── Glisser-déposer : déplacer (jour + heure) ou étirer (durée) ── */
  const demarrer = (e: RPointerEvent, x: Entretien, mode: "deplace" | "duree") => {
    if (e.button !== 0) return;
    e.preventDefault();
    const carte = e.currentTarget as HTMLElement;
    if (x.statut === "termine") { ouvrirFiche(x.id, carte); return; }
    const g = grille.current!; const r = g.getBoundingClientRect();
    const largeurJour = (r.width - 56) / jours.length;
    const x0 = e.clientX, y0 = e.clientY, dateOrig = new Date(x.date), dureeOrig = x.dureeMin;
    let bouge = false, courant = { date: x.date, dureeMin: dureeOrig };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!bouge && Math.hypot(dx, dy) < 4) return;
      bouge = true;
      if (mode === "deplace") {
        const dJours = Math.round(dx / largeurJour);
        const iOrig = jours.findIndex((j) => memeJour(j, dateOrig));
        const i = Math.max(0, Math.min(jours.length - 1, iOrig + dJours));
        const m = Math.max(h0 * 60, Math.min(h1 * 60 - dureeOrig, arrondi(minutes(x.date) + (dy / H) * 60)));
        const d = new Date(jours[i]); d.setHours(Math.floor(m / 60), m % 60, 0, 0);
        courant = { date: d.toISOString(), dureeMin: dureeOrig };
      } else {
        courant = { date: x.date, dureeMin: Math.max(PAS, arrondi(dureeOrig + (dy / H) * 60)) };
      }
      setGlisse({ id: x.id, mode, ...courant });
    };
    const up = () => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up);
      setGlisse(null);
      if (!bouge) { ouvrirFiche(x.id, carte); return; }
      if (new Date(courant.date).getTime() < ref.getTime() && mode === "deplace") { toast("Impossible de déplacer un entretien dans le passé"); return; }
      actions.deplacer(x.id, courant.date, courant.dureeMin);
      void envoyerCreneau(x.id).catch(() => toast("Moteur injoignable : le candidat n'a pas encore le nouveau créneau"));
      toast(mode === "deplace" ? `${x.candidat.prenom} : déplacé au ${jourLong(courant.date)} à ${heure(courant.date)}` : `${x.candidat.prenom} : durée ${courant.dureeMin} min`);
    };
    addEventListener("pointermove", move); addEventListener("pointerup", up);
  };

  /* ── Clic sur un créneau vide : nouvel entretien à cette heure ── */
  const creneau = (e: RMouseEvent<HTMLDivElement>, j: Date) => {
    if ((e.target as Element).closest(".cal__ev") || e.detail === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const m = Math.max(h0 * 60, arrondi(h0 * 60 + ((e.clientY - r.top) / H) * 60));
    const d = new Date(j); d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    if (d.getTime() < ref.getTime()) { toast("Ce créneau est déjà passé"); return; }
    setFiche(null);
    ouvrirNouvelEntretien({ date: isoDate(d), heure: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` });
  };

  // À l'ouverture et à chaque changement de semaine : on se place sur l'heure utile (maintenant, ou le premier entretien)
  useEffect(() => {
    const el = defile.current; if (!el) return;
    const premiers = semaine.map((x) => minutes(x.date));
    const cible = offset === 0 ? Math.min(nowMin, ...premiers) : Math.min(8 * 60, ...premiers);
    el.scrollTo({ top: Math.max(0, ((cible - h0 * 60) / 60) * H - 40), behavior: "smooth" });
  }, [offset, h0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Échap ferme la fiche
  useEffect(() => { if (!fiche) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFiche(null); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [fiche]);

  const ouvert = fiche ? etat.entretiens.find((x) => x.id === fiche) ?? null : null;

  return (
    <section ref={section} className="panel cal cal--ouvert" style={v({ "--i": 1, viewTransitionName: "calendrier" })}>
      <header className="cal__head">
        <div className="cal__titre">
          <h1 className="t-display">{offset === 0 ? "Cette semaine" : `Semaine du ${semaineDu(start)}`}</h1>
          <div className="cal__resume">
            <Pill ton="soft-blue" icon={<IcClock />}>{semaine.filter((x) => x.statut !== "termine").length} à venir</Pill>
            {semaine.some((x) => nbSignauxAVerifier(x) > 0) && <Pill ton="soft-gold" icon={<IcFlag />}>{semaine.filter((x) => nbSignauxAVerifier(x) > 0).length} signal{semaine.filter((x) => nbSignauxAVerifier(x) > 0).length > 1 ? "s" : ""} à vérifier</Pill>}
            {semaine.some((x) => x.statut === "termine" && nbSignauxAVerifier(x) === 0) && <Pill ton="soft-green" icon={<IcCheck />}>{semaine.filter((x) => x.statut === "termine" && nbSignauxAVerifier(x) === 0).length} vérifié{semaine.filter((x) => x.statut === "termine" && nbSignauxAVerifier(x) === 0).length > 1 ? "s" : ""}</Pill>}
            <span className="muted t-small cal__astuce">Glissez pour déplacer · cliquez un créneau libre pour créer</span>
          </div>
        </div>
        <div className="cal__tools">
          <ICirc size="sm" label="Semaine précédente" onClick={() => aller_(offset - 1)}><IcArrowL /></ICirc>
          <Pop align="right" width={280} button={({ open, toggle }) => <Btn icon={<IcCal />} onClick={toggle} aria-expanded={open}>Semaine du {semaineDu(start)} <IcChevron /></Btn>}>
            {(close) => (
              <>
                <div className="menu__title">Aller à</div>
                {[-2, -1, 0, 1, 2, 3].map((o) => (
                  <button key={o} type="button" className="menu__item" aria-current={o === offset} onClick={() => { aller_(o); close(); }}>
                    Semaine du {semaineDu(plusJours(lundi(ref), o * 7))}{o === 0 && <span className="menu__sub">· cette semaine</span>}
                  </button>
                ))}
              </>
            )}
          </Pop>
          <ICirc size="sm" label="Semaine suivante" onClick={() => aller_(offset + 1)}><IcArrowR /></ICirc>
          {onReduire && <ICirc size="sm" label="Réduire le calendrier" onClick={onReduire}><IcChevron style={{ transform: "rotate(180deg)" }} /></ICirc>}
          <Pop align="right" width={290} button={({ open, toggle }) => <Btn icon={<IcFilter />} onClick={toggle} aria-expanded={open}>Filtrer{filtres.length > 0 && <span className="btn__count">{filtres.length}</span>}</Btn>}>
            {() => (
              <>
                <div className="menu__title">Montrer seulement</div>
                {FILTRES.map((f) => { const on = filtres.includes(f.id); return <button key={f.id} type="button" className="menu__item" aria-pressed={on} onClick={() => basculer(f.id)}><span className={`check${on ? " check--on" : ""}`}>{on && <IcCheck />}</span>{f.label}</button>; })}
                {filtres.length > 0 && <button type="button" className="menu__item" onClick={() => transition(() => setFiltres([]))}><IcX width={16} height={16} />Tout montrer</button>}
              </>
            )}
          </Pop>
        </div>
      </header>

      <div ref={defile} className="cal__scroll">
        <div ref={grille} className="cal__grille" style={v({ "--n": jours.length, "--h": `${H}px`, "--lignes": heures.length - 1 })}>
          <div className="cal__coin" />
          {jours.map((j) => (
            <div key={+j} className={`cal__jour${memeJour(j, ref) ? " cal__jour--today" : ""}`}><span>{jourNom(j)}</span><b>{j.getDate()}</b></div>
          ))}
          <div className="cal__axe">{heures.slice(0, -1).map((h) => <span key={h} style={{ top: (h - h0) * H }}>{String(h).padStart(2, "0")}:00</span>)}</div>
          {jours.map((j, ij) => {
            const duJour = semaine.filter((x) => memeJour(new Date(glisse?.id === x.id && glisse.mode === "deplace" ? glisse.date : x.date), j))
              .map((x) => (glisse?.id === x.id ? { ...x, date: glisse.mode === "deplace" ? glisse.date : x.date, dureeMin: glisse.dureeMin } : x));
            const places = placer(duJour);
            const auj = memeJour(j, ref);
            return (
              <div key={+j} className={`cal__col${auj ? " cal__col--today" : ""}${estWE(j) ? " cal__col--we" : ""}`} style={v({ gridColumn: ij + 2 })} onClick={(e) => creneau(e, j)}>
                {heures.slice(0, -1).map((h) => <div key={h} className="cal__cell" style={{ top: (h - h0) * H }} aria-hidden />)}
                {auj && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <i className="cal__now" style={{ top: ((nowMin - h0 * 60) / 60) * H }} aria-hidden />}
                {places.map(({ x, debut, col, n }) => {
                  const ton = tonDe(x, ref);
                  const top = ((debut - h0 * 60) / 60) * H, hauteur = Math.max(26, (x.dureeMin / 60) * H);
                  const enGlisse = glisse?.id === x.id;
                  const etroit = n > 2 || hauteur < 34;
                  return (
                    <article key={x.id} className={`cal__ev cal__ev--${ton}${enGlisse ? " is-drag" : ""}${fiche === x.id ? " is-open" : ""}${etroit ? " is-etroit" : ""}${x.statut !== "termine" ? " is-mobile" : ""}${hauteur >= 66 && n === 1 ? " is-haut" : ""}`}
                      style={v({ top, height: hauteur, left: `calc(${(col / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, viewTransitionName: `cal-${x.id}` })}
                      tabIndex={0} role="button" aria-label={`${nomComplet(x)} · ${plage(x.date, x.dureeMin)}`} title={`${nomComplet(x)} · ${plage(x.date, x.dureeMin)} · ${x.statut === "termine" ? statutEntretien(x, ref).texte : statutPreVerif(x, ref).texte}`}
                      onPointerDown={(e) => demarrer(e, x, "deplace")}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrirFiche(x.id, e.currentTarget); } }}>
                      <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} size="sm" />
                      <span className="cal__evTxt"><strong>{x.candidat.prenom} {x.candidat.nom[0]}.</strong><span>{hauteur >= 40 ? plage(x.date, x.dureeMin) : heure(x.date)}</span></span>
                      <span className="cal__evIc" aria-hidden>{x.statut === "termine" ? (nbSignauxAVerifier(x) > 0 ? <IcFlag /> : statutEntretien(x, ref).ton === "green" ? <IcCheck /> : <IcDots />) : <IcClock />}</span>
                      {hauteur >= 66 && n === 1 && <span className="pill pill--glass cal__evChip">• {x.statut === "termine" ? statutEntretien(x, ref).texte : statutPreVerif(x, ref).texte.replace(/^\d\/4 · /, "")}</span>}
                      {x.statut !== "termine" && <i className="cal__poignee" onPointerDown={(e) => { e.stopPropagation(); demarrer(e, x, "duree"); }} aria-hidden />}
                    </article>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <footer className="cal__legende">
        <span><i className="dot dot--blue" /> Aujourd'hui</span><span><i className="dot dot--neutral" /> À venir</span>
        <span><i className="dot dot--green" /> Présence vérifiée</span><span><i className="dot dot--gold" /> Signal à vérifier</span>
      </footer>

      {ouvert && <Fiche x={ouvert} ref_={ref} ancre={ancre} largeur={section.current?.clientWidth ?? 0} onClose={() => setFiche(null)} />}
    </section>
  );
}

/* ── Fiche d'un entretien : décaler, changer la durée, ouvrir, supprimer ── */
function Fiche({ x, ref_, ancre, largeur, onClose }: { x: Entretien; ref_: Date; ancre: { x: number; y: number; w: number; h: number } | null; largeur: number; onClose: () => void }) {
  const [confirmer, setConfirmer] = useState(false);
  // Position : à droite de la carte si la place le permet, sinon à gauche ; alignée sur son haut
  const L = 340;
  const style: CSSProperties | undefined = ancre ? (ancre.x + ancre.w + 12 + L <= largeur
    ? { top: Math.max(8, ancre.y - 8), left: ancre.x + ancre.w + 12 }
    : { top: Math.max(8, ancre.y - 8), left: Math.max(8, ancre.x - L - 12) }) : undefined;
  const termine = x.statut === "termine";
  const d = new Date(x.date);
  const st = termine ? statutEntretien(x, ref_) : statutPreVerif(x, ref_);
  const changer = (date: string, heureTxt: string, duree: number) => {
    const n = new Date(`${date}T${heureTxt}`);
    if (isNaN(+n)) return;
    if (n.getTime() < ref_.getTime()) { toast("Cette date est déjà passée"); return; }
    actions.deplacer(x.id, n.toISOString(), duree);
    void envoyerCreneau(x.id).catch(() => undefined);
  };
  const date = isoDate(d), heureTxt = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return (
    <>
      <div className="cal__fond" onPointerDown={onClose} />
      <aside className={`panel cal__fiche pop${ancre ? " cal__fiche--ancree" : ""}`} style={style} role="dialog" aria-label={`Entretien de ${nomComplet(x)}`}>
        <div className="cal__ficheHead">
          <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} size="lg" />
          <div className="grow"><strong>{nomComplet(x)}</strong><div className="t-small muted">{x.candidat.poste}</div></div>
          <ICirc size="sm" label="Fermer" onClick={onClose}><IcX /></ICirc>
        </div>
        <div className="row wrap" style={{ gap: 6 }}>
          <Pill ton={st.ton} dot>{st.texte}</Pill>
          {x.creneau?.statut === "confirme" && <Pill ton="soft-green" dot>Créneau confirmé par le candidat</Pill>}
          {x.creneau?.statut === "propose" && x.creneau.propose && <Pill ton="soft-gold" dot>Propose {jourLong(x.creneau.propose)} à {heure(x.creneau.propose)}</Pill>}
          {x.creneau?.statut === "attente" && !termine && <Pill dot>Créneau en attente de réponse</Pill>}
        </div>
        {termine ? (
          <p className="t-small muted">{jourLong(x.date)} · {plage(x.date, x.dureeMin)}. Un entretien terminé ne se déplace plus.</p>
        ) : (
          <div className="cal__ficheForm">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => changer(e.target.value, heureTxt, x.dureeMin)} /></Field>
            <Field label="Heure"><Input type="time" step={900} value={heureTxt} onChange={(e) => changer(date, e.target.value, x.dureeMin)} /></Field>
            <Field label="Durée"><Select value={x.dureeMin} onChange={(e) => changer(date, heureTxt, Number(e.target.value))}>{[15, 30, 45, 60, 75, 90, 120].includes(x.dureeMin) ? null : <option value={x.dureeMin}>{x.dureeMin} min</option>}{[15, 30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</Select></Field>
          </div>
        )}
        <div className="cal__ficheActions">
          <Btn size="sm" icon={<IcArrowUR />} onClick={() => { aller(`#/rapport/${x.id}`); onClose(); }}>{termine ? "Ouvrir le rapport" : "Voir la fiche"}</Btn>
          {!termine && <LigneVisio x={x} />}
          <Btn size="sm" variant="ghost" icon={<IcX />} className="cal__suppr" onClick={() => setConfirmer(true)}>Supprimer</Btn>
        </div>
      </aside>
      <Modal open={confirmer} onClose={() => setConfirmer(false)} title={`Supprimer l'entretien de ${x.candidat.prenom} ?`}>
        <p className="muted">{termine ? "Le rapport et les signaux relevés seront perdus." : "Le lien de pré-vérification envoyé au candidat ne mènera plus nulle part."}</p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <Btn variant="ghost" onClick={() => setConfirmer(false)}>Annuler</Btn>
          <Btn variant="primary" onClick={() => { actions.supprimer(x.id); setConfirmer(false); onClose(); toast(`Entretien de ${x.candidat.prenom} supprimé`); }}>Supprimer</Btn>
        </div>
      </Modal>
    </>
  );
}

/* ── Aperçu replié : bandeau de la semaine, visages par jour, bouton d'ouverture ── */
export function CalendrierApercu({ onOuvrir }: { onOuvrir: () => void }) {
  const etat = useEtat();
  const ref = aujourdhui(etat);
  const start = lundi(ref);
  const semaine = etat.entretiens.filter((x) => { const k = (debutJour(new Date(x.date)).getTime() - start.getTime()) / JOUR; return k >= 0 && k < 7; });
  const jours = [0, 1, 2, 3, 4, 5, 6].map((k) => plusJours(start, k)).filter((j) => !estWE(j) || memeJour(j, ref) || semaine.some((x) => memeJour(new Date(x.date), j)));
  const aVenir = semaine.filter((x) => x.statut !== "termine").length;
  const signaux = semaine.filter((x) => nbSignauxAVerifier(x) > 0).length;
  const verifies = semaine.filter((x) => x.statut === "termine" && nbSignauxAVerifier(x) === 0).length;
  const prochain = etat.entretiens.filter((x) => x.statut !== "termine" && new Date(x.date).getTime() + x.dureeMin * 60000 > ref.getTime()).sort((a, b) => +new Date(a.date) - +new Date(b.date))[0];
  return (
    <section className="panel cal cal--ferme" style={v({ "--i": 1, viewTransitionName: "calendrier" })}>
      <div className="calf__gauche">
        <h1 className="t-display">Cette semaine</h1>
        <div className="cal__resume">
          <Pill ton="soft-blue" icon={<IcClock />}>{aVenir} à venir</Pill>
          {signaux > 0 && <Pill ton="soft-gold" icon={<IcFlag />}>{signaux} signal{signaux > 1 ? "s" : ""} à vérifier</Pill>}
          {verifies > 0 && <Pill ton="soft-green" icon={<IcCheck />}>{verifies} vérifié{verifies > 1 ? "s" : ""}</Pill>}
        </div>
        {prochain && <p className="calf__prochain"><span className="muted">Prochain :</span> <strong>{nomComplet(prochain)}</strong> · {memeJour(new Date(prochain.date), ref) ? "aujourd'hui" : jourLong(prochain.date)} à {heure(prochain.date)}</p>}
        <Btn variant="primary" size="lg" icon={<IcCal />} onClick={onOuvrir} className="calf__btn">Ouvrir le calendrier</Btn>
      </div>
      <button type="button" className="calf__bande" onClick={onOuvrir} aria-label="Ouvrir le calendrier de la semaine">
        {jours.map((j) => {
          const liste = semaine.filter((x) => memeJour(new Date(x.date), j)).sort((a, b) => +new Date(a.date) - +new Date(b.date));
          const auj = memeJour(j, ref);
          return (
            <span key={+j} className={`calf__jour${auj ? " calf__jour--today" : ""}`}>
              <span className={`daytag${auj ? " daytag--today" : estWE(j) ? " daytag--we" : ""}`}><span>{jourNom(j)}<b>{j.getDate()}</b></span></span>
              <span className="calf__pile">
                {liste.slice(0, 4).map((x) => <Avatar key={x.id} initiales={initiales(x)} couleur={x.candidat.couleur} photo={x.candidat.photo} size="sm" title={`${nomComplet(x)} · ${heure(x.date)}`} />)}
                {liste.length > 4 && <span className="calf__plus">+{liste.length - 4}</span>}
                {!liste.length && <span className="calf__vide">libre</span>}
              </span>
              <span className="calf__n">{liste.length ? `${liste.length} entretien${liste.length > 1 ? "s" : ""}` : ""}</span>
            </span>
          );
        })}
      </button>
    </section>
  );
}
