import { useEffect, useRef, useState } from "react";
import type { Decision, DefiType } from "../store/types";
import { actions, aujourdhui, getEtat, initiales, nomComplet, parId, useEtat } from "../store/store";
import { abonnerPanneau, calculerScore, emettre, signalDefi, simulerDefi } from "../store/integration";
import { DECISIONS, DEFI_NOMS, DEFI_PHRASES } from "../store/texts";
import { heure } from "../store/format";
import { etiquetteDefi, point, statutEntretien, statutPreVerif, type Etiquette } from "../store/statuts";
import { Manta, type MantaState } from "../manta/Manta";
import { FaceScan } from "../ui/FaceScan";
import { Avatar, Btn, Pill } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcArrowUR, IcCheck, IcFlag, IcRefresh } from "../ui/icons";
import { aller } from "../app/router";
import "./panel.css";

/**
 * PANNEAU RECRUTEUR — 360 px, une information principale par état.
 * Piloté par les événements `EvenementPanneau` (voir integration.ts) : le moteur de défis
 * de l'équipe envoie les mêmes événements que la simulation ci-dessous.
 * Démo : 1 attente · 2 défi · 3 résultat · 4 fin · A vrai visage · B visage substitué · R remise à zéro · D barre démo.
 */
export type EtapePanneau = "attente" | "defi" | "analyse" | "resultat" | "fin";
const ORDRE: DefiType[] = ["main_devant_visage", "rotation_tete", "phrase_aleatoire"];
const DECIDER = ["poursuivre", "refaire_defi", "presentiel"] as const;
const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const nouvelId = () => `d-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function PanelOval({ entretienId, embedded }: { entretienId: string; embedded?: boolean }) {
  const etat = useEtat();
  const x = parId(etat, entretienId);
  const [etape, setEtape] = useState<EtapePanneau>(() => (parId(getEtat(), entretienId)?.statut === "termine" ? "fin" : "attente"));
  const [defiId, setDefiId] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<"vrai" | "substitue">("vrai");
  const [demo, setDemo] = useState(false);
  const [debut] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const idRef = useRef(entretienId);
  idRef.current = entretienId;
  const clics = useRef<number[]>([]);

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);

  // Seul endroit qui applique les événements : simulation et vrai moteur passent par ici.
  useEffect(() => abonnerPanneau((ev) => {
    const id = idRef.current;
    switch (ev.type) {
      case "defi_propose": actions.demarrer(id); actions.majDefi(id, ev.defi); setDefiId(ev.defi.id); setEtape("defi"); break;
      case "defi_en_cours": { const d = parId(getEtat(), id)?.defis.find((y) => y.id === ev.defiId); if (d) actions.majDefi(id, { ...d, resultat: "en_cours" }); setDefiId(ev.defiId); setEtape("analyse"); break; }
      case "defi_resultat": actions.majDefi(id, ev.defi); setDefiId(ev.defi.id); setEtape("resultat"); break;
      case "signal": actions.ajouterSignal(id, ev.signal); break;
      case "score": actions.setScore(id, ev.score); break;
      case "entretien_termine": { const m = parId(getEtat(), id); if (m?.defis.length) actions.setScore(id, calculerScore(m)); actions.terminer(id); setEtape("fin"); break; }
      default: break;
    }
  }), []);

  const defis = x?.defis ?? [];
  const courant = defis.find((d) => d.id === defiId) ?? null;
  const actifs = etat.reglages.defisActifs.length ? etat.reglages.defisActifs : ORDRE;
  const pre = x?.preVerification;
  const sigPre = pre?.signaux.filter((s) => s.resultat === "a_verifier") ?? [];
  const ordre: DefiType[] = sigPre.some((s) => s.type === "camera_virtuelle") && actifs.includes("main_devant_visage") ? ["main_devant_visage", ...actifs.filter((t) => t !== "main_devant_visage")] : actifs;
  const fait = (t: DefiType) => defis.some((d) => d.type === t && d.resultat !== "propose" && d.resultat !== "en_cours");
  const prochain = (exclure?: DefiType) => ordre.find((t) => !fait(t) && t !== exclure) ?? ordre.find((t) => t !== exclure) ?? ordre[0];
  const minute = () => (defis.length ? Math.max(...defis.map((d) => d.finMin ?? d.debutMin ?? 0)) + 6 : 4);

  const proposer = (type: DefiType = prochain(), debutMin = minute()) =>
    emettre({ type: "defi_propose", defi: { id: nouvelId(), type, phrase: DEFI_PHRASES[type], proposePar: "manta", resultat: "propose", debutMin } });
  const autre = () => {
    if (!courant || !x) return proposer();
    actions.retirerDefi(x.id, courant.id);
    proposer(prochain(courant.type), courant.debutMin);
  };
  const passer = () => { if (courant) emettre({ type: "defi_resultat", defi: { ...courant, resultat: "passe", detail: "Défi passé", finMin: (courant.debutMin ?? 0) + 2 } }); };
  const ilLaFait = async () => {
    if (!courant) return;
    const d = courant;
    emettre({ type: "defi_en_cours", defiId: d.id });
    const res = await simulerDefi(d, simulation === "substitue" && d.type !== "phrase_aleatoire");
    if (parId(getEtat(), idRef.current)?.defis.find((y) => y.id === d.id)?.resultat !== "en_cours") return;
    emettre({ type: "defi_resultat", defi: res });
    if (res.resultat === "a_verifier") emettre({ type: "signal", signal: signalDefi(res) });
    const m = parId(getEtat(), idRef.current);
    if (m) emettre({ type: "score", score: calculerScore(m) });
  };
  const terminer = () => emettre({ type: "entretien_termine" });
  const decider = (v: Decision["valeur"]) => { if (!x) return; actions.decider(x.id, v); toast(`Décision enregistrée : ${DECISIONS[v]}`); };
  const ouvrirRapport = () => { if (!x) return; if (embedded) aller(`#/rapport/${x.id}`); else window.open(`index.html#/rapport/${x.id}`, "_blank", "noopener"); };
  const remettre = () => { if (!x) return; actions.remettreAZero(x.id); setDefiId(null); setEtape("attente"); toast("Entretien remis à zéro pour la démo"); };
  const tripleClic = () => { const t = Date.now(); clics.current = [...clics.current.filter((c) => t - c < 700), t]; if (clics.current.length >= 3) { setDemo((v) => !v); clics.current = []; } };

  // Raccourcis du mode démo
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = e.key.toLowerCase();
      if (c === "1") setEtape("attente");
      else if (c === "2") { if (courant?.resultat === "propose") setEtape("defi"); else proposer(); }
      else if (c === "3") { if (courant?.resultat === "propose") void ilLaFait(); else if (etape !== "analyse") proposer(); }
      else if (c === "4") terminer();
      else if (c === "a") { setSimulation("vrai"); toast("Démo : vrai visage"); }
      else if (c === "b") { setSimulation("substitue"); toast("Démo : visage substitué"); }
      else if (c === "r") remettre();
      else if (c === "d") setDemo((v) => !v);
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  });

  const racine = `pnl ${embedded ? "pnl--embarque" : "pnl--seul"}`;
  if (!x || !pre) return <div className={racine}><p className="muted">Entretien introuvable.</p><Btn href={embedded ? "#/" : "index.html#/"}>Tableau de bord</Btn></div>;

  // Statut en direct
  const live: Etiquette = defis.some((d) => d.resultat === "a_verifier") ? { texte: "Signal à vérifier", ton: "soft-gold" }
    : defis.some((d) => d.resultat === "reussi") ? { texte: "Présence vérifiée", ton: "soft-green" }
    : x.statut === "termine" ? statutEntretien(x, aujourdhui(etat)) : { texte: x.statut === "en_cours" ? "En cours" : "Prêt", ton: "soft-blue" };

  // Ce que dit Manta
  let mstate: MantaState = "neutre";
  let msg = "";
  if (etape === "attente") msg = pre.statut !== "faite" ? "Pas de pré-vérification : ce n'est pas un signal. On fera les défis en direct." : sigPre.length ? `La pré-vérification a relevé un point : ${sigPre[0].libelle.toLowerCase()}. Je te propose un défi adapté.` : "Pré-vérification cohérente. Je te propose un premier défi quand tu veux.";
  if (etape === "defi") { mstate = "defi"; msg = "Demande-lui, naturellement :"; }
  if (etape === "analyse") { mstate = "analyse"; msg = "Je vérifie le geste…"; }
  if (etape === "resultat" && courant) {
    if (courant.resultat === "a_verifier") { mstate = "signal"; msg = `Signal à vérifier : ${(courant.detail ?? "l'image s'est déformée").toLowerCase()}. Je te propose un second défi.`; }
    else if (courant.resultat === "reussi") { mstate = "verifie"; msg = `${courant.detail ?? "Geste exécuté"}, rien d'anormal.`; }
    else msg = "Défi passé : ce n'est pas un signal.";
  }
  if (etape === "fin") msg = x.decision.valeur === "non_prise" ? "C'est à toi de décider. Je garde la trace dans le rapport." : "Décision enregistrée. Tout est dans le rapport.";

  const lignes: { label: string; e: Etiquette }[] = [
    { label: "Pré-vérification", e: pre.statut === "faite" ? (sigPre.length ? { texte: "À vérifier", ton: "soft-gold" } : { texte: "Cohérent", ton: "soft-green" }) : { texte: pre.refuseeLe ? "Refusée" : "Non faite", ton: "neutral" } },
    ...ordre.map((t) => { const d = [...defis].reverse().find((y) => y.type === t); return { label: DEFI_NOMS[t], e: d ? etiquetteDefi(d.resultat) : { texte: "Pas encore", ton: "neutral" as const } }; }),
  ];
  const reste = !!courant && (courant.resultat === "a_verifier" || ordre.some((t) => !fait(t)));
  const rang = courant ? defis.indexOf(courant) + 1 : 0;

  return (
    <div className={racine}>
      <header className="pnl__head">
        <span className="pnl__logo"><span className="logo-o" />oval</span>
        <Pill ton={live.ton} dot>{live.texte}</Pill>
      </header>
      <div className="card pnl__who">
        <Avatar size="sm" initiales={initiales(x)} couleur={x.candidat.couleur} />
        <div className="pnl__whoTxt"><strong>{nomComplet(x)}</strong><span>{x.candidat.poste} · {heure(x.date)}</span></div>
        <span className="pnl__chrono num">{x.statut === "termine" ? "Terminé" : mmss(now - debut)}</span>
      </div>
      <div className="card pnl__manta" aria-live="polite">
        <Manta size={56} state={mstate} onClick={tripleClic} title="Manta (triple-clic : mode démo)" />
        <p>{msg}</p>
      </div>

      {etape === "attente" && (
        <section className="card pnl__card pop">
          <div className="pnl__row"><strong>Entretien détecté</strong><Pill ton="today">{heure(x.date)}</Pill></div>
          <p className="t-small muted">Pré-vérification : {statutPreVerif(x, aujourdhui(etat)).texte.toLowerCase()}</p>
          {sigPre.map((s) => <div key={s.id} className="pnl__alerte"><Pill ton="soft-gold" icon={<IcFlag />}>À vérifier</Pill><span>{s.libelle}</span></div>)}
          <Btn variant="primary" block onClick={() => proposer()}>Proposer un défi</Btn>
        </section>
      )}
      {etape === "defi" && courant && (
        <section className="pnl__defi pop">
          <div className="pnl__row"><strong>Défi proposé</strong><span className="pill pill--white">{rang} sur {Math.max(ordre.length, rang)}</span></div>
          <q>{courant.phrase}</q>
          <div className="pnl__btns">
            <Btn variant="primary" size="sm" icon={<IcCheck />} onClick={() => void ilLaFait()}>Il l'a fait</Btn>
            <Btn variant="glass" size="sm" icon={<IcRefresh />} onClick={autre}>Autre défi</Btn>
            <Btn variant="glass" size="sm" onClick={passer}>Passer</Btn>
          </div>
        </section>
      )}
      {etape === "analyse" && (
        <section className="card pnl__card pnl__analyse pop">
          <div className="pnl__mini"><FaceScan etat="scan" largeur={70} /></div>
          <div><strong>Analyse du geste</strong><p className="t-small muted">Dans le navigateur. Aucune vidéo n'est enregistrée.</p><div className="progress"><i /></div></div>
        </section>
      )}
      {etape === "resultat" && courant && (
        <section className="card pnl__card pop">
          <div className="pnl__row"><strong>{DEFI_NOMS[courant.type]}</strong><Pill ton={etiquetteDefi(courant.resultat).ton} dot>{etiquetteDefi(courant.resultat).texte}</Pill></div>
          {courant.detail && <p className="t-small muted">{courant.detail}</p>}
          {x.score && <p className="t-small">Indice de fiabilité : <b className="num">{x.score.valeur}</b>/100 · consultatif</p>}
          <div className="pnl__btns">
            {reste && <Btn variant="primary" size="sm" onClick={() => proposer(courant.resultat === "a_verifier" ? prochain(courant.type) : prochain())}>{courant.resultat === "a_verifier" ? "Proposer un second défi" : "Défi suivant"}</Btn>}
            <Btn size="sm" onClick={terminer}>Terminer</Btn>
          </div>
        </section>
      )}
      {etape === "fin" && (
        <section className="card pnl__card pop">
          <div className="pnl__row"><strong>Votre décision</strong><Pill ton={x.decision.valeur === "non_prise" ? "neutral" : "soft-blue"} dot>{x.decision.valeur === "non_prise" ? "En attente" : "Enregistrée"}</Pill></div>
          {x.score && <p className="t-small">Indice de fiabilité : <b className="num">{x.score.valeur}</b>/100 · consultatif</p>}
          <div className="pnl__decision">
            {DECIDER.map((v) => (
              <button key={v} type="button" className={`btn btn--sm btn--block ${x.decision.valeur === v ? "btn--primary" : "btn--secondary"}`} aria-pressed={x.decision.valeur === v} onClick={() => decider(v)}>
                {x.decision.valeur === v && <IcCheck />}{DECISIONS[v]}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card pnl__card">
        <strong>Signaux</strong>
        <ul className="pnl__sig">
          {lignes.map((l) => <li key={l.label}><i className={`dot dot--${point(l.e.ton)}`} /><span className="grow">{l.label}</span><Pill ton={l.e.ton}>{l.e.texte}</Pill></li>)}
        </ul>
      </section>

      <div className="pnl__bas">
        <p className="pnl__note">Oval vérifie une présence humaine, pas une identité. Vous décidez.</p>
        {etape === "fin" ? <Btn variant="primary" block icon={<IcArrowUR />} onClick={ouvrirRapport}>Ouvrir le rapport</Btn> : <Btn variant="primary" block onClick={terminer}>Terminer l'entretien</Btn>}
      </div>

      {demo && (
        <div className="demo" role="toolbar" aria-label="Mode démo">
          <button aria-pressed={etape === "attente"} onClick={() => setEtape("attente")}>1 Attente</button>
          <button aria-pressed={etape === "defi"} onClick={() => (courant?.resultat === "propose" ? setEtape("defi") : proposer())}>2 Défi</button>
          <button aria-pressed={etape === "resultat"} onClick={() => (courant?.resultat === "propose" ? void ilLaFait() : proposer())}>3 Résultat</button>
          <button aria-pressed={etape === "fin"} onClick={terminer}>4 Fin</button>
          <span className="demo__sep" />
          <button aria-pressed={simulation === "vrai"} onClick={() => setSimulation("vrai")}>Vrai visage</button>
          <button aria-pressed={simulation === "substitue"} onClick={() => setSimulation("substitue")}>Visage substitué</button>
          <span className="demo__sep" />
          <button onClick={remettre}>↺ Zéro</button>
        </div>
      )}
    </div>
  );
}
