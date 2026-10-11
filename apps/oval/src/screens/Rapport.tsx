import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { Defi, DefiType, Entretien, Signal } from "../store/types";
import { actions, aujourdhui, initiales, nbSignauxAVerifier, nomComplet, parId, recruteur, useEtat } from "../store/store";
import { debutJour, heure, jourCourt, quand, relatif } from "../store/format";
import { DECISIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { doux, etapesFaites, etiquetteDefi, etiquetteEtape, etiquetteSignal, point, statutEntretien, statutPreVerif } from "../store/statuts";
import { envoyerPreVerif } from "../store/envoi";
import { envoyerDecision, lienPanneau, lienVisio } from "../store/moteur";
import { Manta } from "../manta/Manta";
import { Avatar, Btn, Pill, Vide } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowL, IcArrowUR, IcCheck, IcChevron, IcDots, IcDownload, IcFlag, IcHand, IcMail, IcMic, IcPlay, IcRefresh, IcSun } from "../ui/icons";
import { EnConstruction } from "./EnConstruction";
import "./rapport.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const DECIDER = ["poursuivre", "refaire_defi", "presentiel"] as const;
const JOUR = 86400000;
const ICONE: Record<DefiType, ReactNode> = { main_devant_visage: <IcHand />, rotation_tete: <IcRefresh />, phrase_aleatoire: <IcMic /> };

/** « la veille, 18:12 », « le jour même, 09:12 », « jeu 8 oct, 18:12 » */
function momentPre(faite: string, entretien: string) {
  const j = Math.round((debutJour(new Date(entretien)).getTime() - debutJour(new Date(faite)).getTime()) / JOUR);
  return `${j === 0 ? "le jour même" : j === 1 ? "la veille" : jourCourt(faite)}, ${heure(faite)}`;
}

export function Rapport({ id }: { id: string }) {
  const etat = useEtat();
  const x = parId(etat, id);
  if (!x) return <EnConstruction titre="Rapport introuvable" texte="Cet entretien n'existe pas ou a été supprimé." />;
  const ref = aujourdhui(etat);
  const st = statutEntretien(x, ref);
  const termine = x.statut === "termine";
  return (
    <div className="rp">
      <header className="rp__top rise" style={v({ "--i": 1 })}>
        <a className="rp__back" href="#/entretiens"><IcArrowL /> Entretiens</a>
        <div className="rp__who">
          <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} size="lg" />
          <div>
            <h1>{nomComplet(x)}</h1>
            <span>{x.candidat.poste} · {jourCourt(x.date)}, {heure(x.date)}{termine ? ` · ${x.dureeMin} min` : ""} · mené par {recruteur(etat, x.recruteurId).nom}</span>
          </div>
        </div>
        <div className="rp__actions">
          <Pill ton={doux(st.ton)} dot>{st.texte}</Pill>
          {!termine && <Btn variant="now" icon={<IcPlay />} href={lienVisio(x)} newTab={!!x.moteur}>Rejoindre avec Oval</Btn>}
          <Btn icon={<IcDownload />} href={`#/rapport/${x.id}/imprimer`}>Exporter</Btn>
        </div>
      </header>

      <div className="rp__hero">
        <Jauge x={x} />
        <Chiffres x={x} />
        {/* Entretien relié au moteur : la décision peut se prendre dès que la pré-vérification est faite (elle clôt l'entretien côté serveur). */}
        {termine || (x.moteur && x.preVerification.statut === "faite") ? <Decision x={x} /> : <AvantEntretien x={x} />}
      </div>

      <div className="rp__bas">
        {termine ? <Chronologie x={x} /> : <Preparation x={x} ref_={ref} />}
        <SignauxReleves x={x} />
      </div>
    </div>
  );
}

/* ── Jauge : l'indice consultatif et ce qu'en dit Manta ─────── */
function Jauge({ x }: { x: Entretien }) {
  const sig = nbSignauxAVerifier(x) > 0;
  const val = x.score?.valeur;
  const texte = x.score?.resume ?? (x.statut === "termine" ? "Aucun défi n'a été mené : je m'appuie seulement sur la pré-vérification." : "Le résumé arrivera après l'entretien, à partir des signaux relevés.");
  const R = 54, C = 2 * Math.PI * R, ARC = C * 0.75;
  const rempli = val === undefined ? 0 : (val / 100) * ARC;
  const ton = val === undefined ? "neutral" : sig ? "gold" : "green";
  return (
    <section className={`panel rp__jauge rp__jauge--${ton} rise`} style={v({ "--i": 2 })}>
      <div className="jauge" role="img" aria-label={val === undefined ? "Indice non calculé" : `Indice de fiabilité ${val} sur 100`}>
        <svg viewBox="0 0 140 140">
          <circle className="jauge__fond" cx="70" cy="70" r={R} strokeDasharray={`${ARC} ${C}`} transform="rotate(135 70 70)" />
          <circle className="jauge__val" cx="70" cy="70" r={R} strokeDasharray={`${rempli} ${C}`} transform="rotate(135 70 70)" />
        </svg>
        <div className="jauge__centre">
          <b className="num">{val ?? "—"}</b>
          <span>{val === undefined ? "pas encore" : "/ 100"}</span>
        </div>
      </div>
      <div className="rp__jaugeTxt">
        <h2>Indice de fiabilité <small>consultatif</small></h2>
        <div className="rp__manta"><Manta size={48} state={sig ? "signal" : x.score ? "verifie" : "neutre"} /><p>{texte.split("\n\n")[0]}</p></div>
        <p className="t-small faint">Oval vérifie une présence humaine, pas une identité. La décision vous appartient.</p>
      </div>
    </section>
  );
}

/* ── Chiffres clés ─────────────────────────────────────────── */
function Chiffres({ x }: { x: Entretien }) {
  const p = x.preVerification;
  const pv = p.statut === "faite" ? `${etapesFaites(x)}/4` : p.refuseeLe ? "Refusée" : p.statut === "non_envoyee" ? "Non envoyée" : "En attente";
  const reussis = x.defis.filter((d) => d.resultat === "reussi").length;
  const faits = x.defis.filter((d) => d.resultat !== "propose" && d.resultat !== "en_cours").length;
  const sig = [...x.signaux, ...x.preVerification.signaux].filter((s) => s.resultat === "a_verifier").length;
  const tuiles: { ic: ReactNode; val: string; label: string; ton: "green" | "gold" | "blue" | "neutral" }[] = [
    { ic: <IcCheck />, val: pv, label: "Pré-vérification", ton: p.statut === "faite" ? (p.signaux.some((s) => s.resultat === "a_verifier") ? "gold" : "green") : "neutral" },
    { ic: <IcHand />, val: x.statut === "termine" ? `${reussis}/${faits || 0}` : "—", label: "Défis réussis", ton: x.statut === "termine" && faits ? (reussis === faits ? "green" : "gold") : "neutral" },
    { ic: <IcFlag />, val: String(sig), label: sig > 1 ? "Signaux à vérifier" : "Signal à vérifier", ton: sig ? "gold" : "green" },
    { ic: <IcPlay />, val: x.statut === "termine" ? `${x.dureeMin} min` : `${x.dureeMin} min`, label: x.statut === "termine" ? "Durée" : "Prévu", ton: "blue" },
  ];
  return (
    <section className="rp__tuiles rise" style={v({ "--i": 3 })}>
      {tuiles.map((t) => (
        <div key={t.label} className={`panel tuile tuile--${t.ton}`}>
          <span className="tuile__ic">{t.ic}</span>
          <b className="num">{t.val}</b>
          <span className="tuile__label">{t.label}</span>
        </div>
      ))}
    </section>
  );
}

/* ── Chronologie verticale : ce qui s'est passé, minute par minute ── */
type Moment = { id: string; minute: number; ic: ReactNode; titre: string; sous: string; etiquette: { texte: string; ton: Parameters<typeof Pill>[0]["ton"] }; detail: ReactNode; attention?: boolean };
function Chronologie({ x }: { x: Entretien }) {
  const [ouvert, setOuvert] = useState<string | null>(() => x.defis.find((d) => d.resultat === "a_verifier")?.id ?? null);
  const p = x.preVerification;
  const pre = statutPreVerif(x, aujourdhui(useEtat()));
  const moments: Moment[] = [{
    id: "pre", minute: -1, ic: <IcCheck />, titre: "Pré-vérification", sous: p.faiteLe ? momentPre(p.faiteLe, x.date) : p.refuseeLe ? "refusée par le candidat" : "non faite · pas un signal",
    etiquette: p.statut === "faite" ? { texte: pre.texte, ton: pre.ton } : { texte: "Pas un signal", ton: "neutral" }, detail: <PreDetail x={x} />,
  }];
  x.defis.forEach((d) => {
    const e = etiquetteDefi(d.resultat);
    const sig = x.signaux.find((s) => s.minute !== undefined && d.debutMin !== undefined && s.minute >= d.debutMin && s.minute <= (d.finMin ?? d.debutMin + 5));
    moments.push({
      id: d.id, minute: d.debutMin ?? 0, ic: ICONE[d.type], titre: `Défi · ${DEFI_NOMS[d.type].toLowerCase()}`, sous: `${d.proposePar === "manta" ? "proposé par Manta" : "relance du recruteur"}${d.detail ? ` · ${d.detail}` : ""}`,
      etiquette: { texte: e.texte, ton: e.ton }, attention: d.resultat === "a_verifier" && x.decision.valeur === "non_prise",
      detail: <div className="col"><q className="rp__phrase">{d.phrase}</q><dl className="kv"><dt>Moment</dt><dd>minute {d.debutMin ?? 0} à {d.finMin ?? (d.debutMin ?? 0) + 5}</dd>{d.detail && <><dt>Observé</dt><dd>{d.detail}</dd></>}</dl>{sig && <div className="rp__manta"><Manta size={44} state="signal" /><p>{sig.explication}</p></div>}</div>,
    });
  });
  moments.push({ id: "fin", minute: x.dureeMin, ic: <IcDots />, titre: "Fin de l'entretien", sous: `${x.dureeMin} minutes`, etiquette: { texte: x.score ? `Indice ${x.score.valeur}` : "Sans indice", ton: "soft-blue" }, detail: <p className="t-small muted">{x.score?.resume ?? "Aucun indice calculé : aucun défi mené."}</p> });
  const total = Math.max(x.dureeMin, ...x.defis.map((d) => d.finMin ?? 0), 1);
  return (
    <section className="panel rp__chrono rise" style={v({ "--i": 4 })}>
      <header className="rp__h"><h2 className="t-h2">Déroulé de l'entretien</h2><span className="muted t-small">{x.defis.length} défi{x.defis.length > 1 ? "s" : ""} · {x.dureeMin} min</span></header>
      <div className="piste" aria-hidden>
        <i className="piste__ligne" />
        {x.defis.map((d) => <i key={d.id} className={`piste__pt piste__pt--${point(etiquetteDefi(d.resultat).ton)}`} style={{ left: `${Math.min(98, ((d.debutMin ?? 0) / total) * 100)}%` }} title={DEFI_NOMS[d.type]} />)}
        <span className="piste__t" style={{ left: 0 }}>0 min</span><span className="piste__t" style={{ left: "100%" }}>{total} min</span>
      </div>
      <ol className="chrono">
        {moments.map((m) => (
          <li key={m.id} className={`chrono__item${m.attention ? " is-attention" : ""}`}>
            <span className="chrono__min">{m.minute < 0 ? "avant" : `${m.minute} min`}</span>
            <span className={`chrono__ic chrono__ic--${point(m.etiquette.ton ?? "neutral")}`}>{m.ic}</span>
            <div className="chrono__corps">
              <button type="button" className="chrono__tete" aria-expanded={ouvert === m.id} onClick={() => setOuvert((o) => (o === m.id ? null : m.id))}>
                <span className="chrono__titre"><b>{m.titre}</b><span>{m.sous}</span></span>
                <Pill ton={m.etiquette.ton} dot>{m.etiquette.texte}</Pill>
                <IcChevron className="chrono__chev" />
              </button>
              {ouvert === m.id && <div className="chrono__detail pop">{m.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      {!x.defis.length && <Vide titre="Aucun défi n'a été proposé pendant cet entretien." texte="Ce n'est pas un signal : le rapport s'appuie alors sur la pré-vérification." />}
    </section>
  );
}

/* ── Avant l'entretien : préparation ───────────────────────── */
function defisConseilles(x: Entretien, actifs: DefiType[]): { type: DefiType; raison?: string }[] {
  const cam = x.preVerification.signaux.find((s) => s.type === "camera_virtuelle" && s.resultat === "a_verifier");
  const ordre: DefiType[] = cam ? ["main_devant_visage", ...actifs.filter((t) => t !== "main_devant_visage")] : actifs;
  return ordre.map((type, i) => ({ type, raison: i === 0 && cam ? "Adapté au point relevé : caméra virtuelle déclarée" : undefined }));
}
function Preparation({ x, ref_ }: { x: Entretien; ref_: Date }) {
  const etat = useEtat();
  const p = x.preVerification;
  const etapes: [string, ReactNode, boolean | Parameters<typeof etiquetteEtape>[0]][] = [["Accord", <IcCheck />, p.etapes.accord], ["Caméra", <IcPlay />, p.etapes.camera], ["Lumière", <IcSun />, p.etapes.lumiere], ["Geste", <IcHand />, p.etapes.geste]];
  return (
    <section className="panel rp__chrono rise" style={v({ "--i": 4 })}>
      <header className="rp__h"><h2 className="t-h2">Préparation</h2><Pill ton={statutPreVerif(x, ref_).ton} dot>{statutPreVerif(x, ref_).texte}</Pill></header>
      <div className="prep__etapes">
        {etapes.map(([label, ic, val]) => { const e = etiquetteEtape(val); return (
          <div key={label} className={`prep__etape prep__etape--${point(e.ton)}`}><span className="chrono__ic">{ic}</span><strong>{label}</strong><span>{e.texte}</span></div>
        ); })}
      </div>
      {p.statut === "non_envoyee" ? <p className="muted t-small">Le lien de pré-vérification n'a pas encore été envoyé. Ce n'est pas un problème : les défis peuvent se faire en direct.</p> : (
        <dl className="kv rp__kv">
          <dt>Lien envoyé</dt><dd>{p.envoyeeLe ? quand(p.envoyeeLe, ref_) : "—"}</dd>
          {p.relanceeLe && <><dt>Relancé</dt><dd>{quand(p.relanceeLe, ref_)}</dd></>}
          <dt>Ouvert</dt><dd>{p.ouverteLe ? quand(p.ouverteLe, ref_) : "Pas encore"}</dd>
          <dt>Valable jusqu'à</dt><dd>{p.lien ? quand(p.lien.expireLe, ref_) : "l'entretien"}</dd>
        </dl>
      )}
      <h3 className="t-h3">Défis conseillés pendant la visio</h3>
      <ol className="prep__defis">
        {defisConseilles(x, etat.reglages.defisActifs.length ? etat.reglages.defisActifs : ["main_devant_visage", "rotation_tete", "phrase_aleatoire"]).map(({ type, raison }, i) => (
          <li key={type}><span className="chrono__ic chrono__ic--blue">{ICONE[type]}</span><div><strong>{i + 1}. {DEFI_NOMS[type]}</strong><q>{DEFI_PHRASES[type]}</q>{raison && <Pill ton="soft-gold" icon={<IcFlag />}>{raison}</Pill>}</div></li>
        ))}
      </ol>
    </section>
  );
}

/* ── Signaux relevés ───────────────────────────────────────── */
function SignauxReleves({ x }: { x: Entretien }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const rang = (r: string) => (r === "a_verifier" ? 0 : r === "coherent" ? 1 : 2);
  const liste: Signal[] = [...x.signaux, ...x.preVerification.signaux].sort((a, b) => rang(a.resultat) - rang(b.resultat));
  const n = liste.filter((s) => s.resultat === "a_verifier").length;
  return (
    <section className="panel rp__sig rise" style={v({ "--i": 5 })}>
      <header className="rp__h"><h2 className="t-h2">Signaux relevés</h2><Pill ton={n ? "soft-gold" : "soft-green"} dot>{n ? `${n} à vérifier` : "Rien à signaler"}</Pill></header>
      <ul className="sigs">
        {liste.map((s) => {
          const e = etiquetteSignal(s);
          return (
            <li key={s.id}>
              <button type="button" className="sig" aria-expanded={ouvert === s.id} onClick={() => setOuvert((o) => (o === s.id ? null : s.id))}>
                <i className={`dot dot--${point(e.ton)}`} /><span className="sig__lib">{s.libelle}<small>{s.source === "preverification" ? "pré-vérification" : `minute ${s.minute ?? "?"}`}</small></span><Pill ton={e.ton}>{e.texte}</Pill><IcChevron className="sig__chev" />
              </button>
              {ouvert === s.id && <p className="sig__exp pop">{s.explication}</p>}
            </li>
          );
        })}
      </ul>
      {!liste.length && <Vide titre="Aucun signal relevé." texte="L'absence de signal ne compte ni pour ni contre : seules les contradictions comptent." />}
      <p className="t-small faint">Un signal est un point à vérifier, jamais un verdict.</p>
    </section>
  );
}

/* ── Décision du recruteur ─────────────────────────────────── */
function Decision({ x }: { x: Entretien }) {
  const etat = useEtat();
  const [note, setNote] = useState(x.decision.note ?? "");
  useEffect(() => { setNote(x.decision.note ?? ""); }, [x.id]); // eslint-disable-line
  const d = x.decision;
  const choisir = (val: (typeof DECIDER)[number]) => {
    actions.decider(x.id, val, note);
    toast(`Décision enregistrée : ${DECISIONS[val]}`);
    // Entretien relié au moteur : la décision part au serveur (qui efface alors les biométries) et revient dans son rapport.
    if (x.moteur) envoyerDecision(x, val, note).catch((e) => toast(`Décision gardée en local, moteur injoignable (${e instanceof Error ? e.message : e})`));
  };
  const sauver = () => { if (note !== (x.decision.note ?? "")) { actions.noter(x.id, note); toast("Note enregistrée"); } };
  return (
    <section className={`panel rp__dec rise${d.valeur === "non_prise" ? " is-attente" : ""}`} style={v({ "--i": 4 })}>
      <header className="rp__h"><h2 className="t-h2">Votre décision</h2><Pill ton={d.valeur === "non_prise" ? "soft-gold" : "soft-green"} dot>{d.valeur === "non_prise" ? "À prendre" : "Enregistrée"}</Pill></header>
      <div className="rp__choix">
        {DECIDER.map((val) => (
          <button key={val} type="button" className={`rp__opt${d.valeur === val ? " is-on" : ""}`} aria-pressed={d.valeur === val} onClick={() => choisir(val)}>
            <span className="rp__optIc">{d.valeur === val ? <IcCheck /> : <i />}</span>{DECISIONS[val]}
          </button>
        ))}
      </div>
      <textarea className="field__ctl" rows={2} value={note} placeholder="Note pour l'équipe (facultatif)" onChange={(e) => setNote(e.target.value)} onBlur={sauver} />
      {d.valeur !== "non_prise" && d.le && <p className="t-small faint">Décidé par {recruteur(etat, d.par ?? etat.moi).nom} · {quand(d.le, aujourdhui(etat))}</p>}
    </section>
  );
}

function AvantEntretien({ x }: { x: Entretien }) {
  const p = x.preVerification;
  return (
    <section className="panel rp__dec rise" style={v({ "--i": 4 })}>
      <header className="rp__h"><h2 className="t-h2">Avant l'entretien</h2></header>
      <Btn variant="now" block size="lg" icon={<IcPlay />} href={lienVisio(x)} newTab={!!x.moteur}>Rejoindre avec Oval</Btn>
      {p.statut === "non_envoyee" && <Btn block icon={<IcMail />} onClick={() => void envoyerPreVerif(x.id)}>Envoyer le lien de pré-vérification</Btn>}
      {p.statut !== "non_envoyee" && p.statut !== "faite" && <Btn block icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>Relancer le lien{p.envoyeeLe ? ` · envoyé ${relatif(p.envoyeeLe).toLowerCase()}` : ""}</Btn>}
      <Btn block variant="ghost" icon={<IcArrowUR />} href={lienPanneau(x)} newTab>Ouvrir le panneau seul (360 px)</Btn>
      <p className="t-small faint">La décision se prend après l'entretien. Le recruteur décide, l'outil éclaire.</p>
    </section>
  );
}

function PreDetail({ x }: { x: Entretien }) {
  const p = x.preVerification;
  const lignes: [string, Parameters<typeof etiquetteEtape>[0]][] = [["Accord", p.etapes.accord], ["Caméra", p.etapes.camera], ["Test de lumière", p.etapes.lumiere], ["Défi gestuel", p.etapes.geste]];
  return (
    <div className="col">
      <div className="prep__etapes prep__etapes--mini">{lignes.map(([l, val]) => { const e = etiquetteEtape(val); return <div key={l} className={`prep__etape prep__etape--${point(e.ton)}`}><strong>{l}</strong><span>{e.texte}</span></div>; })}</div>
      <p className="t-small faint">Une étape passée ou une pré-vérification non faite n'est jamais un signal négatif.</p>
    </div>
  );
}
