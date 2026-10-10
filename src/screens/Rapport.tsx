import { Fragment, useEffect, useState, type CSSProperties } from "react";
import type { Defi, DefiType, Entretien } from "../store/types";
import { actions, aujourdhui, initiales, nomComplet, parId, recruteur, useEtat } from "../store/store";
import { debutJour, heure, jourCourt, quand, relatif } from "../store/format";
import { DECISIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { doux, etapesFaites, etiquetteDefi, etiquetteEtape, etiquetteSignal, point, statutEntretien, statutPreVerif } from "../store/statuts";
import { envoyerPreVerif } from "../store/envoi";
import { Manta } from "../manta/Manta";
import { Avatar, Bar, Btn, Modal, Pill, Vide, type BarTon } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowL, IcArrowUR, IcCheck, IcChevron, IcDots, IcDownload, IcFlag, IcMail, IcPlay, IcRefresh } from "../ui/icons";
import { EnConstruction } from "./EnConstruction";
import "./rapport.css";

const v = (o: Record<string, string | number>) => o as CSSProperties;
const DECIDER = ["poursuivre", "refaire_defi", "presentiel"] as const;
const JOUR = 86400000;

/** « la veille, 18:12 », « le jour même, 09:12 », « jeu 8 oct, 18:12 » */
function momentPre(faite: string, entretien: string) {
  const j = Math.round((debutJour(new Date(entretien)).getTime() - debutJour(new Date(faite)).getTime()) / JOUR);
  return `${j === 0 ? "le jour même" : j === 1 ? "la veille" : jourCourt(faite)}, ${heure(faite)}`;
}
const tonDefi = (d: Defi): BarTon => (d.resultat === "reussi" ? "green" : d.resultat === "a_verifier" ? "gold" : d.resultat === "propose" || d.resultat === "en_cours" ? "blue" : "neutral");

type Detail = { kind: "defi"; d: Defi } | { kind: "pre" };

export function Rapport({ id }: { id: string }) {
  const etat = useEtat();
  const x = parId(etat, id);
  const [detail, setDetail] = useState<Detail | null>(null);
  if (!x) return <EnConstruction titre="Rapport introuvable" texte="Cet entretien n'existe pas ou a été supprimé." />;
  const ref = aujourdhui(etat);
  const st = statutEntretien(x, ref);
  const termine = x.statut === "termine";
  return (
    <div className="rapport">
      <header className="panel rapport__top rise" style={v({ "--i": 1 })}>
        <Btn icon={<IcArrowL />} href="#/entretiens">Entretiens</Btn>
        <Avatar initiales={initiales(x)} couleur={x.candidat.couleur} />
        <div className="rapport__id">
          <h1>{nomComplet(x)}</h1>
          <span className="muted">{x.candidat.poste} · {jourCourt(x.date)}, {heure(x.date)}{termine ? ` · ${x.dureeMin} min` : ""}</span>
        </div>
        <div className="grow" />
        <Pill ton={doux(st.ton)} dot>{st.texte}</Pill>
        {!termine && <Btn variant="now" icon={<IcPlay />} href={`#/visio/${x.id}`}>Rejoindre avec Oval</Btn>}
        <Btn icon={<IcDownload />} href={`#/rapport/${x.id}/imprimer`}>Exporter</Btn>
      </header>

      {termine ? <Deroule x={x} onDetail={setDetail} /> : <Preparation x={x} ref_={ref} onDetail={setDetail} />}

      <div className="rapport__bas">
        <SignauxReleves x={x} />
        <Sens x={x} />
        {termine ? <Decision x={x} /> : <AvantEntretien x={x} />}
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.kind === "defi" ? `Défi · ${DEFI_NOMS[detail.d.type].toLowerCase()}` : "Pré-vérification"}>
        {detail?.kind === "defi" && <DefiDetail d={detail.d} x={x} />}
        {detail?.kind === "pre" && <PreDetail x={x} />}
      </Modal>
    </div>
  );
}

/* ── Déroulé minute par minute ─────────────────────────────── */
function Deroule({ x, onDetail }: { x: Entretien; onDetail: (d: Detail) => void }) {
  const etat = useEtat();
  const fin = Math.max(x.dureeMin, ...x.defis.map((d) => d.finMin ?? 0));
  const n = Math.floor(Math.max(fin - 1, 0) / 5) + 1;
  const total = n * 5;
  const pos = (debut: number, duree: number) => {
    const largeur = Math.min(total, Math.max(duree, 15));
    const d = Math.max(0, Math.min(debut, total - largeur));
    return { left: `calc((100% + 8px) * ${d / 5} / ${n})`, width: `calc((100% + 8px) * ${largeur / 5} / ${n} - 8px)` };
  };
  const p = x.preVerification;
  const sigPre = p.signaux.some((s) => s.resultat === "a_verifier");
  const nb = etapesFaites(x);
  const pre: { ton: BarTon; label: string; chip: string } = p.statut === "faite"
    ? sigPre ? { ton: "gold", label: "Pré-vérification", chip: "Signal à vérifier" }
      : p.etapes.lumiere === "passe" ? { ton: "green", label: `${nb} étapes sur 4`, chip: "Lumière passée" }
      : p.etapes.lumiere === "non_concluant" ? { ton: "neutral", label: `${nb} étapes sur 4`, chip: "Non concluant" }
      : { ton: "green", label: `${nb} étapes sur 4`, chip: "Cohérent" }
    : { ton: "neutral", label: p.refuseeLe ? "Refusée" : "Non faite", chip: "Pas un signal" };
  const incline = x.decision.valeur === "non_prise" ? x.defis.find((d) => d.resultat === "a_verifier")?.id : undefined;
  const cellules = Array.from({ length: n }, (_, k) => <div key={k} className="cell" />);
  return (
    <section className="panel deroule rise" style={v({ "--i": 2 })}>
      <header className="deroule__head">
        <h2 className="t-display">Déroulé de l'entretien</h2>
        <span className="pill pill--white">Mené par {recruteur(etat, x.recruteurId).nom}</span>
      </header>
      <div className="deroule__scroll">
        <div className="deroule__grid">
          <div className="dr__row">
            <div />
            <div className="dr__track" style={v({ "--n": n })}>{Array.from({ length: n }, (_, k) => <div key={k} className="daytag dr__time">{k * 5} min</div>)}</div>
          </div>
          <div className="dr__row">
            <div className="dr__label"><strong>Pré-vérification</strong><span>{p.faiteLe ? momentPre(p.faiteLe, x.date) : "avant l'entretien"}</span></div>
            <div className="dr__track" style={v({ "--n": n })}>
              {cellules}
              <div className="dr__bar grow-x" style={{ ...pos(0, 15), ...v({ "--i": 0 }) }}>
                <Bar ton={pre.ton} icon={pre.ton === "gold" ? <IcFlag /> : pre.ton === "green" ? <IcCheck /> : <IcDots />} label={pre.label} chip={pre.chip} onClick={() => onDetail({ kind: "pre" })} />
              </div>
            </div>
          </div>
          {x.defis.map((d, i) => (
            <div key={d.id} className="dr__row">
              <div className="dr__label"><strong>Défi · {DEFI_NOMS[d.type].toLowerCase()}</strong><span>{d.proposePar === "manta" ? "proposé par Manta" : "relance du recruteur"}</span></div>
              <div className="dr__track" style={v({ "--n": n })}>
                {cellules}
                <div className="dr__bar grow-x" style={{ ...pos(d.debutMin ?? 0, (d.finMin ?? (d.debutMin ?? 0) + 5) - (d.debutMin ?? 0)), ...v({ "--i": i + 1 }) }}>
                  <Bar ton={tonDefi(d)} icon={d.resultat === "reussi" ? <IcCheck /> : d.resultat === "a_verifier" ? <IcFlag /> : <IcDots />} label={d.detail ?? etiquetteDefi(d.resultat).texte} chip={etiquetteDefi(d.resultat).texte}
                    attention={d.id === incline} onClick={() => onDetail({ kind: "defi", d })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
function Preparation({ x, ref_, onDetail }: { x: Entretien; ref_: Date; onDetail: (d: Detail) => void }) {
  const etat = useEtat();
  const p = x.preVerification;
  const s = statutPreVerif(x, ref_);
  const etapes: [string, boolean | Parameters<typeof etiquetteEtape>[0]][] = [["Accord", p.etapes.accord], ["Caméra", p.etapes.camera], ["Lumière", p.etapes.lumiere], ["Geste", p.etapes.geste]];
  return (
    <section className="panel deroule rise" style={v({ "--i": 2 })}>
      <header className="deroule__head">
        <h2 className="t-display">Préparation de l'entretien</h2>
        <Pill ton={s.ton} dot>{s.texte}</Pill>
      </header>
      <div className="prep">
        <div className="prep__gauche">
          <div className="prep__etapes">
            {etapes.map(([label, val], i) => { const e = etiquetteEtape(val); return (
              <button key={label} type="button" className="card lift prep__etape" onClick={() => onDetail({ kind: "pre" })}>
                <span className="prep__num">{i + 1}</span><strong>{label}</strong><Pill ton={e.ton} dot>{e.texte}</Pill>
              </button>
            ); })}
          </div>
          <div className="card prep__lien">
            {p.statut === "non_envoyee" ? <p className="muted">Le lien de pré-vérification n'a pas encore été envoyé. Ce n'est pas un problème : les défis peuvent se faire en direct.</p> : (
              <dl className="kv">
                <dt>Lien envoyé</dt><dd>{p.envoyeeLe ? quand(p.envoyeeLe, ref_) : "—"}</dd>
                {p.relanceeLe && <><dt>Relancé</dt><dd>{quand(p.relanceeLe, ref_)}</dd></>}
                <dt>Ouvert</dt><dd>{p.ouverteLe ? quand(p.ouverteLe, ref_) : "Pas encore"}</dd>
                <dt>Valable jusqu'à</dt><dd>{p.lien ? quand(p.lien.expireLe, ref_) : "l'entretien"}</dd>
              </dl>
            )}
          </div>
        </div>
        <div className="prep__defis">
          <h3 className="t-h3">Défis conseillés</h3>
          {defisConseilles(x, etat.reglages.defisActifs.length ? etat.reglages.defisActifs : ["main_devant_visage", "rotation_tete", "phrase_aleatoire"]).map(({ type, raison }) => (
            <div key={type} className="card prep__defi">
              <strong>{DEFI_NOMS[type]}</strong>
              <q>{DEFI_PHRASES[type]}</q>
              {raison && <Pill ton="soft-gold" icon={<IcFlag />}>{raison}</Pill>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Signaux relevés ───────────────────────────────────────── */
function SignauxReleves({ x }: { x: Entretien }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const rang = (r: string) => (r === "a_verifier" ? 0 : r === "coherent" ? 1 : 2);
  const liste = [...x.signaux, ...x.preVerification.signaux].sort((a, b) => rang(a.resultat) - rang(b.resultat));
  return (
    <section className="panel bloc rise" style={v({ "--i": 3 })}>
      <h2 className="t-h2">Signaux relevés</h2>
      {x.preVerification.statut !== "faite" && (
        <div className="sig sig--fixe"><i className="dot dot--neutral" /><span className="grow">Pré-vérification {x.preVerification.refuseeLe ? "refusée" : "non faite"}</span><Pill>Pas un signal</Pill></div>
      )}
      <ul className="sigs">
        {liste.map((s) => {
          const e = etiquetteSignal(s);
          return (
            <li key={s.id}>
              <button type="button" className="sig" aria-expanded={ouvert === s.id} onClick={() => setOuvert((o) => (o === s.id ? null : s.id))}>
                <i className={`dot dot--${point(e.ton)}`} /><span className="grow">{s.libelle}</span><Pill ton={e.ton}>{e.texte}</Pill><IcChevron className="sig__chev" />
              </button>
              {ouvert === s.id && <p className="sig__exp pop">{s.explication}{s.minute !== undefined ? ` (minute ${s.minute}.)` : ""}</p>}
            </li>
          );
        })}
      </ul>
      {!liste.length && <Vide titre="Aucun signal relevé pour l'instant." texte="L'absence de signal ne compte ni pour ni contre : seules les contradictions comptent." />}
    </section>
  );
}

/* ── Ce que ça veut dire (Manta) ───────────────────────────── */
function Sens({ x }: { x: Entretien }) {
  const sig = x.defis.some((d) => d.resultat === "a_verifier") || x.signaux.some((s) => s.resultat === "a_verifier");
  const texte = x.score?.resume ?? (x.statut === "termine" ? "Aucun défi n'a été mené : je m'appuie seulement sur la pré-vérification." : "Le résumé arrivera après l'entretien, à partir des signaux relevés.");
  return (
    <section className="panel bloc rise" style={v({ "--i": 4 })}>
      <h2 className="t-h2">Ce que ça veut dire</h2>
      <div className="card sens">
        <Manta size={52} state={sig ? "signal" : x.score ? "verifie" : "neutre"} />
        <div className="sens__txt">{texte.split("\n\n").map((t, i) => <p key={i}>{t}</p>)}</div>
      </div>
      {x.score && <div className="sens__score"><span>Indice de fiabilité</span><b className="num">{x.score.valeur}</b><span>/100 · consultatif</span></div>}
      <p className="t-small faint">Oval vérifie une présence humaine, pas une identité. Ce rapport est une aide, la décision vous appartient.</p>
    </section>
  );
}

/* ── Décision du recruteur ─────────────────────────────────── */
function Decision({ x }: { x: Entretien }) {
  const etat = useEtat();
  const [note, setNote] = useState(x.decision.note ?? "");
  useEffect(() => { setNote(x.decision.note ?? ""); }, [x.id]); // eslint-disable-line
  const d = x.decision;
  const choisir = (val: (typeof DECIDER)[number]) => { actions.decider(x.id, val, note); toast(`Décision enregistrée : ${DECISIONS[val]}`); };
  const sauver = () => { if (note !== (x.decision.note ?? "")) { actions.noter(x.id, note); toast("Note enregistrée"); } };
  return (
    <section className="panel bloc rise" style={v({ "--i": 5 })}>
      <div className="bloc__head"><h2 className="t-h2">Votre décision</h2><Pill ton={d.valeur === "non_prise" ? "neutral" : "soft-blue"} dot>{d.valeur === "non_prise" ? "En attente" : "Enregistrée"}</Pill></div>
      <div className="decision">
        {DECIDER.map((val) => (
          <button key={val} type="button" className={`btn btn--block ${d.valeur === val ? "btn--primary" : "btn--secondary"}`} aria-pressed={d.valeur === val} onClick={() => choisir(val)}>
            {d.valeur === val && <IcCheck />}{DECISIONS[val]}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field__label">Note pour l'équipe</span>
        <textarea className="field__ctl" rows={3} value={note} placeholder="Ajouter une note…" onChange={(e) => setNote(e.target.value)} onBlur={sauver} />
      </label>
      {d.valeur !== "non_prise" && d.le && <p className="t-small faint">Décidé par {recruteur(etat, d.par ?? etat.moi).nom} · {quand(d.le, aujourdhui(etat))}</p>}
    </section>
  );
}

function AvantEntretien({ x }: { x: Entretien }) {
  const p = x.preVerification;
  return (
    <section className="panel bloc rise" style={v({ "--i": 5 })}>
      <h2 className="t-h2">Avant l'entretien</h2>
      <Btn variant="now" block icon={<IcPlay />} href={`#/visio/${x.id}`}>Rejoindre avec Oval</Btn>
      {p.statut === "non_envoyee" && <Btn block icon={<IcMail />} onClick={() => void envoyerPreVerif(x.id)}>Envoyer le lien de pré-vérification</Btn>}
      {p.statut !== "non_envoyee" && p.statut !== "faite" && <Btn block icon={<IcRefresh />} onClick={() => void envoyerPreVerif(x.id, true)}>Relancer le lien{p.envoyeeLe ? ` · envoyé ${relatif(p.envoyeeLe).toLowerCase()}` : ""}</Btn>}
      <Btn block icon={<IcArrowUR />} href={`/sidepanel.html?e=${x.id}`} newTab>Ouvrir le panneau seul (360 px)</Btn>
      <p className="t-small faint">La décision se prend après l'entretien, ici ou dans le panneau. Le recruteur décide, l'outil éclaire.</p>
    </section>
  );
}

/* ── Détails ───────────────────────────────────────────────── */
function DefiDetail({ d, x }: { d: Defi; x: Entretien }) {
  const e = etiquetteDefi(d.resultat);
  const sig = x.signaux.find((s) => s.minute !== undefined && d.debutMin !== undefined && s.minute >= d.debutMin && s.minute <= (d.finMin ?? d.debutMin + 5));
  return (
    <div className="col">
      <q className="defi__phrase">{d.phrase}</q>
      <dl className="kv">
        <dt>Résultat</dt><dd><Pill ton={e.ton} dot>{e.texte}</Pill></dd>
        <dt>Moment</dt><dd>minute {d.debutMin ?? 0} à {d.finMin ?? (d.debutMin ?? 0) + 5}</dd>
        <dt>Proposé par</dt><dd>{d.proposePar === "manta" ? "Manta" : "le recruteur"}</dd>
        {d.detail && <><dt>Détail</dt><dd>{d.detail}</dd></>}
      </dl>
      {sig && <div className="card sens"><Manta size={48} state="signal" /><p className="t-small">{sig.explication}</p></div>}
    </div>
  );
}
function PreDetail({ x }: { x: Entretien }) {
  const p = x.preVerification;
  const lignes: [string, Parameters<typeof etiquetteEtape>[0]][] = [["Accord", p.etapes.accord], ["Caméra", p.etapes.camera], ["Test de lumière", p.etapes.lumiere], ["Défi gestuel", p.etapes.geste]];
  return (
    <div className="col">
      <dl className="kv">{lignes.map(([l, val]) => { const e = etiquetteEtape(val); return <Fragment key={l}><dt>{l}</dt><dd><Pill ton={e.ton} dot>{e.texte}</Pill></dd></Fragment>; })}</dl>
      {p.signaux.length > 0 && <ul className="sigs">{p.signaux.map((s) => { const e = etiquetteSignal(s); return <li key={s.id} className="sig sig--fixe"><i className={`dot dot--${point(e.ton)}`} /><span className="grow">{s.libelle}</span><Pill ton={e.ton}>{e.texte}</Pill></li>; })}</ul>}
      <p className="t-small faint">Une étape passée ou une pré-vérification non faite n'est jamais un signal négatif.</p>
    </div>
  );
}
