import { useCallback, useEffect, useRef, useState } from "react";
import type { Decision, Defi, DefiType, Entretien, Score } from "../store/types";
import { actions, getEtat, nomComplet, useEtat } from "../store/store";
import { abonnerPanneau, calculerScore, emettre, simulerDefi } from "../store/integration";
import { DECISIONS, DEFI_NOMS, DEFI_PHRASES, DEFI_RESULTATS, PREVERIF_STATUTS, RESULTATS } from "../store/texts";
import { heure } from "../store/format";
import { Manta, type MantaState } from "../manta/Manta";
import { Btn, Pill } from "../ui/ui";
import { toast } from "../ui/toast";
import { IcCheck, IcRefresh } from "../ui/icons";

/** Panneau recruteur — version fonctionnelle, habillage final à l'étape 3. */
export type Etape = "attente" | "defi" | "resultat" | "fin";
const ORDRE: DefiType[] = ["main_devant_visage", "rotation_tete", "phrase_aleatoire"];

export function Panel() {
  const etat = useEtat();
  const [id, setId] = useState<string>(() => new URLSearchParams(location.search).get("e") ?? getEtat().entretiens.find((e) => e.id === "e-emma")?.id ?? getEtat().entretiens[0].id);
  const entretien: Entretien | undefined = etat.entretiens.find((e) => e.id === id);
  const [etape, setEtape] = useState<Etape>("attente");
  const [defi, setDefi] = useState<Defi | null>(null);
  const [analyse, setAnalyse] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [demo, setDemo] = useState(false);
  const [scenario, setScenario] = useState<"A" | "B">("A");
  const clics = useRef<number[]>([]);

  // Changement de scénario en mode démo (ignoré au premier rendu pour garder ?e=)
  const scenPrec = useRef(scenario);
  useEffect(() => { if (scenPrec.current === scenario) return; scenPrec.current = scenario; setId(scenario === "A" ? "e-emma" : "e-marc"); setScore(null); setDefi(null); setEtape("attente"); }, [scenario]);

  // Flux réel : moteur de défis et serveur de score (voir integration.ts)
  useEffect(() => abonnerPanneau((ev) => {
    switch (ev.type) {
      case "entretien_detecte": setId(ev.entretienId); setEtape("attente"); break;
      case "defi_propose": setDefi(ev.defi); setAnalyse(false); setEtape("defi"); break;
      case "defi_en_cours": setAnalyse(true); break;
      case "defi_resultat": setDefi(ev.defi); setAnalyse(false); if (entretien) actions.majDefi(entretien.id, ev.defi); break;
      case "signal": if (entretien) actions.ajouterSignal(entretien.id, ev.signal); break;
      case "score": setScore(ev.score); if (entretien) actions.setScore(entretien.id, ev.score); setEtape("resultat"); break;
      case "entretien_termine": setEtape("fin"); break;
    }
  }), [entretien]);

  const proposerDefi = useCallback(() => {
    if (!entretien) return;
    const deja = defi ? ORDRE.indexOf(defi.type) : -1;
    const type = ORDRE[(deja + 1) % ORDRE.length];
    const d = actions.ajouterDefi(entretien.id, type);
    emettre({ type: "defi_propose", defi: { ...d, phrase: DEFI_PHRASES[type], debutMin: entretien.defis.length * 6 + 4 } });
  }, [defi, entretien]);

  const verifierDefi = useCallback(async () => {
    if (!defi || !entretien) return;
    emettre({ type: "defi_en_cours", defiId: defi.id });
    const fait = await simulerDefi(defi, scenario === "B");
    emettre({ type: "defi_resultat", defi: fait });
    const maj = { ...entretien, defis: entretien.defis.map((x) => (x.id === fait.id ? fait : x)) };
    emettre({ type: "score", score: calculerScore(maj) });
  }, [defi, entretien, scenario]);

  const decider = (d: Decision["valeur"]) => { if (!entretien) return; actions.decider(entretien.id, d); actions.terminer(entretien.id); toast(`Décision enregistrée : ${DECISIONS[d]}`); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, Etape> = { "1": "attente", "2": "defi", "3": "resultat", "4": "fin" };
      if (map[e.key]) allerA(map[e.key]);
      if (e.key.toLowerCase() === "a") setScenario("A");
      if (e.key.toLowerCase() === "b") setScenario("B");
      if (e.key.toLowerCase() === "d") setDemo((v) => !v);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const allerA = (cible: Etape) => {
    if (cible === "defi" && !defi) proposerDefi();
    if (cible === "resultat" && !score) { if (!defi) proposerDefi(); void verifierDefi(); return; }
    setAnalyse(false); setEtape(cible);
  };
  const clicManta = () => { const now = Date.now(); clics.current = [...clics.current.filter((t) => now - t < 700), now]; if (clics.current.length >= 3) { setDemo((v) => !v); clics.current = []; } };

  if (!entretien) return <div className="panel-wrap"><p className="muted">Aucun entretien.</p></div>;
  const pv = entretien.preVerification;
  const aVerifier = pv.signaux.filter((s) => s.resultat === "a_verifier");
  let mantaState: MantaState = "neutre";
  let phrase = "Tout va bien. Je regarde avec vous.";
  if (etape === "attente" && aVerifier.length) phrase = `${aVerifier.length} point${aVerifier.length > 1 ? "s" : ""} à vérifier pendant l'entretien. Je vous propose des défis adaptés.`;
  if (etape === "defi") { mantaState = analyse ? "analyse" : "defi"; phrase = analyse ? "Je vérifie le geste…" : "Demandez-lui, naturellement :"; }
  if (etape === "resultat" && score) { const sig = entretien.defis.some((d) => d.resultat === "a_verifier"); mantaState = sig ? "signal" : "verifie"; phrase = sig ? "Signal à vérifier : l'image s'est déformée pendant le geste. Je propose un second défi." : "Présence humaine vérifiée."; }
  if (etape === "fin") phrase = "C'est à vous de décider. Je garde la trace.";

  return (
    <div className="panel-wrap">
      <div className="row row--between"><span className="row" style={{ gap: 8 }}><span className="logo-o" style={{ width: 16, height: 24, borderWidth: 4 }} /><strong>oval</strong></span><Pill ton={aVerifier.length || entretien.defis.some((d) => d.resultat === "a_verifier") ? "soft-gold" : "soft-blue"} dot>{nomComplet(entretien)}</Pill></div>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }} onClick={clicManta}><Manta state={mantaState} size={64} /><div className="card" style={{ padding: "12px 14px", flex: 1 }}>{phrase}</div></div>

      {etape === "attente" && (
        <>
          <div className="card" style={{ padding: 16 }}>
            <div className="row row--between"><strong>Entretien détecté</strong><Pill ton="today">{heure(entretien.date)}</Pill></div>
            <div className="t-small muted" style={{ marginTop: 6 }}>{entretien.candidat.poste} · Pré-vérification : {PREVERIF_STATUTS[pv.statut]}{pv.etapes.lumiere ? ` · Lumière : ${RESULTATS[pv.etapes.lumiere]}` : ""}</div>
            {aVerifier.length > 0 && <ul className="col" style={{ marginTop: 10, gap: 8, listStyle: "none", padding: 0 }}>{aVerifier.map((s) => <li key={s.id} className="row" style={{ gap: 8, alignItems: "flex-start" }}><Pill ton="gold">À vérifier</Pill><span className="t-small">{s.libelle}</span></li>)}</ul>}
          </div>
          <Btn variant="primary" block onClick={() => allerA("defi")}>Proposer un défi</Btn>
        </>
      )}
      {etape === "defi" && defi && (
        <>
          <div className="card" style={{ padding: 16 }}><div className="row row--between"><Pill ton="soft-blue">{DEFI_NOMS[defi.type]}</Pill>{analyse && <Pill dot>Analyse en cours</Pill>}</div><p className="t-h2" style={{ marginTop: 10, fontWeight: 500 }}>« {defi.phrase} »</p></div>
          <div className="row" style={{ gap: 8 }}><Btn block icon={<IcRefresh />} onClick={proposerDefi} disabled={analyse}>Autre défi</Btn><Btn block variant="primary" icon={<IcCheck />} onClick={() => void verifierDefi()} disabled={analyse}>{analyse ? "Je vérifie…" : "Il l'a fait"}</Btn></div>
        </>
      )}
      {etape === "resultat" && score && (
        <>
          <div className="card" style={{ padding: 16 }}>
            <div className="row row--between"><span className="t-display num">{score.valeur}<span className="t-small muted"> /100 · consultatif</span></span></div>
            <p className="t-small" style={{ marginTop: 8 }}>{score.resume}</p>
          </div>
          <div className="card" style={{ padding: 16 }}><strong>Défis</strong><ul className="col" style={{ marginTop: 8, gap: 8, listStyle: "none", padding: 0 }}>{entretien.defis.map((d) => <li key={d.id} className="row row--between"><span className="t-small">{DEFI_NOMS[d.type]}</span><Pill ton={d.resultat === "reussi" ? "soft-green" : d.resultat === "a_verifier" ? "soft-gold" : "neutral"}>{DEFI_RESULTATS[d.resultat]}</Pill></li>)}</ul></div>
          <p className="t-small muted">Oval vérifie une présence humaine, pas une identité. Vous décidez.</p>
          <div className="row" style={{ gap: 8 }}><Btn block onClick={() => { proposerDefi(); setEtape("defi"); }}>Nouveau défi</Btn><Btn block variant="primary" onClick={() => setEtape("fin")}>Terminer</Btn></div>
        </>
      )}
      {etape === "fin" && (
        <>
          <div className="card col" style={{ padding: 16, gap: 8 }}>
            <strong>Votre décision</strong>
            {entretien.decision.valeur !== "non_prise" ? <p className="t-small muted">Enregistrée : <b>{DECISIONS[entretien.decision.valeur]}</b></p> : (["poursuivre", "refaire_defi", "presentiel"] as const).map((d, i) => <Btn key={d} block variant={i === 0 ? "primary" : "secondary"} onClick={() => decider(d)}>{DECISIONS[d]}</Btn>)}
          </div>
          <a className="btn btn--ghost" href={`${location.origin}/#/rapport/${entretien.id}`} target="_blank" rel="noreferrer">Ouvrir le rapport →</a>
        </>
      )}

      {demo && (
        <div className="demo" role="toolbar" aria-label="Mode démo">
          {(["attente", "defi", "resultat", "fin"] as Etape[]).map((s, i) => <button key={s} aria-pressed={etape === s} onClick={() => allerA(s)}>{i + 1} {s}</button>)}
          <span className="demo__sep" />
          <button aria-pressed={scenario === "A"} onClick={() => setScenario("A")}>A sans signal</button>
          <button aria-pressed={scenario === "B"} onClick={() => setScenario("B")}>B signal</button>
        </div>
      )}
    </div>
  );
}
