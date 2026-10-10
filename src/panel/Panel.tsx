import { useCallback, useEffect, useRef, useState } from "react";
import type { Decision, Defi, DefiType, Entretien, Score } from "../shared/types";
import { abonnerPanneau, emettre, enregistrerDecision, getEntretiens } from "../shared/api";
import { DEFI_PHRASES } from "../shared/texts";
import { SIGNAUX_EXEMPLE } from "../shared/mock";
import { Attente } from "./states/Attente";
import { DefiEnCours } from "./states/DefiEnCours";
import { Resultat } from "./states/Resultat";
import { Fin } from "./states/Fin";

export type Etape = "attente" | "defi" | "resultat" | "fin";

const ORDRE_DEFIS: DefiType[] = ["main_devant_visage", "rotation_tete", "phrase_aleatoire"];

export function Panel() {
  const [entretien, setEntretien] = useState<Entretien | null>(null);
  const [etape, setEtape] = useState<Etape>("attente");
  const [defi, setDefi] = useState<Defi | null>(null);
  const [analyse, setAnalyse] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [demo, setDemo] = useState(false);
  const [scenario, setScenario] = useState<"A" | "B">("A");
  const clics = useRef<number[]>([]);

  // Chargement du mock : A = candidat sans signal, B = candidat avec signaux
  useEffect(() => {
    getEntretiens().then((liste) => {
      const e = scenario === "A" ? liste.find((x) => x.id === "e1") : liste.find((x) => x.id === "e2");
      setEntretien(e ?? liste[0]);
      setScore(null);
      setDefi(null);
      setEtape("attente");
    });
  }, [scenario]);

  // Flux réel : le moteur de défis et le serveur de score poussent ici (voir api.ts)
  useEffect(
    () =>
      abonnerPanneau((ev) => {
        switch (ev.type) {
          case "entretien_detecte": setEntretien(ev.entretien); setEtape("attente"); break;
          case "defi_propose": setDefi(ev.defi); setAnalyse(false); setEtape("defi"); break;
          case "defi_en_cours": setAnalyse(true); break;
          case "defi_resultat": setDefi(ev.defi); setAnalyse(false); break;
          case "score_mis_a_jour": setScore(ev.score); setEtape("resultat"); break;
          case "entretien_termine": setEtape("fin"); break;
        }
      }),
    [],
  );

  // --- Mode démo : simule le moteur de défis et le serveur de score -----------
  const proposerDefi = useCallback(() => {
    const deja = defi ? ORDRE_DEFIS.indexOf(defi.type) : -1;
    const type = ORDRE_DEFIS[(deja + 1) % ORDRE_DEFIS.length];
    emettre({ type: "defi_propose", defi: { id: `d${Date.now()}`, type, phrase: DEFI_PHRASES[type], resultat: "en_attente" } });
  }, [defi]);

  const verifierDefi = useCallback(() => {
    if (!defi || !entretien) return;
    emettre({ type: "defi_en_cours", defiId: defi.id });
    const avecSignal = scenario === "B";
    window.setTimeout(() => {
      const fait: Defi = { ...defi, resultat: avecSignal ? "signal_a_verifier" : "execute", horodatage: new Date().toISOString() };
      emettre({ type: "defi_resultat", defi: fait });
      const preSignaux = entretien.preVerification.signaux;
      const s: Score = avecSignal
        ? {
            valeur: 41,
            explications: [
              "Pendant le passage de la main, l'image du visage s'est déformée : c'est le signal le plus fort relevé.",
              "La pré-vérification a trouvé une caméra virtuelle. Ce n'est pas une preuve en soi, mais ça s'ajoute au signal précédent.",
              "Le fuseau horaire diffère du lieu déclaré. Un VPN d'entreprise l'explique souvent : à vérifier, pas à conclure.",
            ],
            signaux: [SIGNAUX_EXEMPLE.signalImage, ...preSignaux],
          }
        : {
            valeur: 94,
            explications: [
              "Le geste a été exécuté dans le temps attendu, sans déformation de l'image.",
              "La pré-vérification n'a relevé aucun signal : caméra, fuseau horaire et connexion cohérents avec le lieu déclaré.",
              "Le test de lumière est cohérent : le visage a suivi la séquence de couleurs sans retard.",
            ],
            signaux: [],
          };
      emettre({ type: "score_mis_a_jour", score: s });
    }, 1800);
  }, [defi, entretien, scenario]);

  const decider = useCallback(
    async (d: Decision) => {
      if (!entretien) return;
      await enregistrerDecision(entretien.id, d);
      setEntretien({ ...entretien, decision: d });
    },
    [entretien],
  );

  // Raccourcis clavier : 1-4 = états, A/B = scénario, D = barre démo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const map: Record<string, Etape> = { "1": "attente", "2": "defi", "3": "resultat", "4": "fin" };
      if (map[e.key]) allerA(map[e.key]);
      if (e.key.toLowerCase() === "a") setScenario("A");
      if (e.key.toLowerCase() === "b") setScenario("B");
      if (e.key.toLowerCase() === "d") setDemo((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const allerA = (cible: Etape) => {
    if (cible === "defi" && !defi) proposerDefi();
    if (cible === "resultat" && !score) {
      if (!defi) proposerDefi();
      verifierDefi();
      return;
    }
    setAnalyse(false);
    setEtape(cible);
  };

  // Triple-clic sur la ligne de statut = barre démo
  const clicManta = () => {
    const now = Date.now();
    clics.current = [...clics.current.filter((t) => now - t < 700), now];
    if (clics.current.length >= 3) { setDemo((v) => !v); clics.current = []; }
  };

  // Ligne de statut, selon l'étape (un mot à côté de la couleur, jamais la couleur seule)
  const aDesSignaux = (entretien?.preVerification.signaux.length ?? 0) > 0;
  let dot = "";
  let phrase = "Tout va bien. L'outil regarde avec vous.";
  if (etape === "attente" && aDesSignaux) { dot = "panel__dot--orange"; phrase = "Deux points à vérifier pendant l'entretien. Des défis adaptés vous sont proposés."; }
  if (etape === "defi") { dot = analyse ? "panel__dot--gris" : ""; phrase = analyse ? "Vérification du geste en cours…" : "Demandez-lui, naturellement :"; }
  if (etape === "resultat" && score) {
    dot = score.signaux.length ? "panel__dot--orange" : "";
    phrase = score.signaux.length ? "Signal à vérifier : " + score.signaux[0].libelle.toLowerCase() + "." : "Présence humaine vérifiée.";
  }
  if (etape === "fin") { dot = "panel__dot--gris"; phrase = "C'est à vous de décider. La trace est conservée."; }

  if (!entretien) return <div className="panel"><p className="muted">Chargement…</p></div>;

  return (
    <div className="panel">
      <div className="panel__top">
        <span className="logo"><span className="logo__o" aria-hidden />val</span>
        <span className="pill pill--gris">{entretien.candidat.prenom} {entretien.candidat.nom}</span>
      </div>

      <div className="panel__status" onClick={clicManta}>
        <span className={`panel__dot ${dot}`} aria-hidden />
        <span>{phrase}</span>
      </div>

      {etape === "attente" && <Attente entretien={entretien} onProposer={() => allerA("defi")} />}
      {etape === "defi" && defi && (
        <DefiEnCours defi={defi} analyse={analyse} onAutre={proposerDefi} onVerifier={verifierDefi} />
      )}
      {etape === "resultat" && score && (
        <Resultat score={score} onNouveauDefi={() => { proposerDefi(); setEtape("defi"); }} onTerminer={() => setEtape("fin")} />
      )}
      {etape === "fin" && <Fin entretien={entretien} score={score} onDecider={decider} />}

      {demo && (
        <div className="demo" role="toolbar" aria-label="Mode démo">
          {(["attente", "defi", "resultat", "fin"] as Etape[]).map((s, i) => (
            <button key={s} aria-pressed={etape === s} onClick={() => allerA(s)}>{i + 1} {s}</button>
          ))}
          <span className="demo__sep" />
          <button aria-pressed={scenario === "A"} onClick={() => setScenario("A")}>A sans signal</button>
          <button aria-pressed={scenario === "B"} onClick={() => setScenario("B")}>B signaux</button>
        </div>
      )}
    </div>
  );
}
